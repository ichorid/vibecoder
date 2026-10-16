import { feedCat, noteMeaningfulAction, petCat } from './cat';
import type { Catalog } from './catalog';
import { catchMouse, resumeSession, sessionOf, startSession, withSession } from './catPlaySession';
import { deriveRates, roundAmount, upgradeLevel, upgradePrice } from './economy';
import {
  currentPrimaryAction,
  findUpgrade,
  isUpgradeOffered,
  resolveDiscoveries,
} from './progression';
import type { Transition } from './simulation';
import type { GameCommand, RunState } from './types';

export type CommandResult = 'applied' | 'unavailable' | 'unaffordable' | 'cooldown';

export interface CommandTransition extends Transition {
  readonly result: CommandResult;
}

function reject(run: RunState, result: Exclude<CommandResult, 'applied'>): CommandTransition {
  return { run, facts: [], result };
}

/**
 * Validate and apply one player command at an active timestamp. Expected rejections are
 * results, never exceptions; buttons are advisory and every rule is re-checked here.
 */
export function applyCommand(
  run: RunState,
  command: GameCommand,
  activeTimestamp: number,
  catalog: Catalog,
): CommandTransition {
  if (run.status !== 'playing') return reject(run, 'unavailable');
  switch (command.type) {
    case 'primaryAction':
      return primaryAction(run, catalog);
    case 'acknowledgeUnlock':
      if (!run.pendingUnlockIds.includes(command.id)) return reject(run, 'unavailable');
      return {
        run: { ...run, pendingUnlockIds: run.pendingUnlockIds.filter((id) => id !== command.id) },
        facts: [],
        result: 'applied',
      };
    case 'buyUpgrade':
      return buyUpgrade(run, command.id, catalog);
    case 'startCatPlay': {
      if (!run.cat.alive || run.catPlay !== null) return reject(run, 'unavailable');
      const session = startSession(sessionOf(run), activeTimestamp, catalog.balance.catPlay);
      return { run: withSession(run, session), facts: [], result: 'applied' };
    }
    case 'catchMouse': {
      const caught = catchMouse(
        sessionOf(run),
        command.attemptId,
        activeTimestamp,
        catalog.balance.catPlay,
      );
      if (!caught.accepted) return reject(run, 'unavailable');
      return {
        run: withSession(run, caught.state),
        facts: [{ type: 'catCared', kind: 'play' }],
        result: 'applied',
      };
    }
    case 'leaveCatPlay':
      if (run.catPlay === null) return reject(run, 'unavailable');
      return { run: { ...run, catPlay: null }, facts: [], result: 'applied' };
    case 'resumeCatPlay': {
      if (run.catPlay === null) return reject(run, 'unavailable');
      const resumed = resumeSession(sessionOf(run), activeTimestamp, catalog.balance.catPlay);
      return { run: withSession(run, resumed), facts: [], result: 'applied' };
    }
    case 'feedCat': {
      const fed = feedCat(run.cat, run.rng.cat, activeTimestamp, catalog.balance.cat);
      if (!fed.accepted) return reject(run, fed.reason);
      return {
        run: { ...run, cat: fed.cat, rng: { ...run.rng, cat: fed.rng } },
        facts: [{ type: 'catCared', kind: 'feed' }],
        result: 'applied',
      };
    }
    case 'petCat': {
      const petted = petCat(run.cat, activeTimestamp, catalog.balance.cat);
      if (!petted.accepted) return reject(run, petted.reason);
      return {
        run: { ...run, cat: petted.cat },
        facts: [{ type: 'catCared', kind: 'pet' }],
        result: 'applied',
      };
    }
    default: {
      const unknownCommand: never = command;
      void unknownCommand;
      return reject(run, 'unavailable');
    }
  }
}

function buyUpgrade(run: RunState, id: string, catalog: Catalog): CommandTransition {
  const upgrade = findUpgrade(catalog, id);
  if (!upgrade || !isUpgradeOffered(run, upgrade)) return reject(run, 'unavailable');
  const level = upgradeLevel(run, upgrade.id);
  const price = upgradePrice(upgrade, level);
  if (run.economy.output < price) return reject(run, 'unaffordable');
  const bought: RunState = {
    ...run,
    cat: noteMeaningfulAction(run.cat),
    economy: { ...run.economy, output: roundAmount(run.economy.output - price) },
    upgradeLevels: { ...run.upgradeLevels, [upgrade.id]: level + 1 },
  };
  const discovered = resolveDiscoveries(bought, catalog);
  return {
    run: discovered.run,
    facts: [{ type: 'purchased', id: upgrade.id }, ...discovered.facts],
    result: 'applied',
  };
}

/**
 * The current primary action. Every press spends one charge of a refilling budget, so rapid
 * clicking cannot exceed the intended rate; a press without charge is accepted but adds nothing.
 */
function primaryAction(run: RunState, catalog: Catalog): CommandTransition {
  const cat = noteMeaningfulAction(run.cat);
  if (run.economy.actionCharges < 1) return { run: { ...run, cat }, facts: [], result: 'applied' };
  const rates = deriveRates(run, catalog);
  const action = currentPrimaryAction(run, catalog);
  let economy = { ...run.economy, actionCharges: run.economy.actionCharges - 1 };
  switch (action) {
    case 'writeCode':
      economy = { ...economy, pendingManualWork: economy.pendingManualWork + rates.manualOutput };
      break;
    case 'prompt':
      economy = {
        ...economy,
        pendingManualWork: economy.pendingManualWork + rates.manualOutput,
        tasks: Math.min(catalog.balance.agents.taskQueueCap, economy.tasks + rates.tasksPerPrompt),
      };
      break;
    case 'delegate':
      economy = {
        ...economy,
        delegation: Math.min(catalog.balance.coordination.delegationCap, economy.delegation + 1),
      };
      break;
    case 'supervise':
      economy = {
        ...economy,
        debt: Math.max(0, economy.debt - catalog.balance.coordination.supervisePerPress),
      };
      break;
    default: {
      const unknown: never = action;
      void unknown;
    }
  }
  return { run: { ...run, cat, economy }, facts: [], result: 'applied' };
}
