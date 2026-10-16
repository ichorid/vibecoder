import { feedCat, noteMeaningfulAction, petCat } from './cat';
import { endRun, isChoiceOffered } from './endings';
import type { Catalog } from './catalog';
import { catchMouse, resumeSession, sessionOf, startSession, withSession } from './catPlaySession';
import { deriveRates, offerPrice, roundAmount, tokenPack, upgradeLevel } from './economy';
import {
  currentPrimaryAction,
  findUpgrade,
  isUpgradeOffered,
  resolveDiscoveries,
} from './progression';
import { waterPlant } from './plant';
import { shipRelease } from './releases';
import { makeDemo } from './demos';
import { appendLog } from './log';
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
      if (caught.kind === 'skipped') {
        return { run: withSession(run, caught.state), facts: [], result: 'applied' };
      }
      const hit = caught.state.play?.outcome?.kind === 'hit' ? 1 : 0;
      const played = withSession(run, caught.state);
      return {
        run: { ...played, stats: { ...played.stats, playHits: played.stats.playHits + hit } },
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
    case 'choose': {
      const choice = catalog.choices.find((c) => c.id === command.id);
      if (!choice || !isChoiceOffered(run, choice)) return reject(run, 'unavailable');
      const chosen: RunState = {
        ...run,
        choices: {
          ...run.choices,
          [choice.id]: {
            atActiveMs: activeTimestamp,
            manualActions: run.stats.manualActions,
            overhead: choice.overhead?.(run) ?? 0,
          },
        },
      };
      if (!choice.ends)
        return { run: chosen, facts: [{ type: 'choiceMade', id: choice.id }], result: 'applied' };
      const ended = endRun(chosen, choice.ends);
      return {
        run: ended.run,
        facts: [{ type: 'choiceMade', id: choice.id }, ...ended.facts],
        result: 'applied',
      };
    }
    case 'waterPlant': {
      const watered = waterPlant(run, catalog);
      return watered ? { run: watered, facts: [], result: 'applied' } : reject(run, 'unavailable');
    }
    case 'shipRelease': {
      const shipped = shipRelease(run, catalog);
      if (!shipped.accepted) return reject(run, shipped.reason);
      return { ...shipped.transition, result: 'applied' };
    }
    case 'makeDemo': {
      const made = makeDemo(run, catalog);
      if (!made.accepted) return reject(run, made.reason);
      return { ...made.transition, result: 'applied' };
    }
    case 'feedCat': {
      const fed = feedCat(run.cat, run.rng.cat, activeTimestamp, catalog.balance.cat);
      if (!fed.accepted) return reject(run, fed.reason);
      return {
        run: {
          ...run,
          cat: fed.cat,
          rng: { ...run.rng, cat: fed.rng },
          stats: { ...run.stats, feeds: run.stats.feeds + 1 },
        },
        facts: [{ type: 'catCared', kind: 'feed' }],
        result: 'applied',
      };
    }
    case 'petCat': {
      const petted = petCat(run.cat, activeTimestamp, catalog.balance.cat);
      if (!petted.accepted) return reject(run, petted.reason);
      return {
        run: { ...run, cat: petted.cat, stats: { ...run.stats, pets: run.stats.pets + 1 } },
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
  const price = offerPrice(run, upgrade, catalog);
  const balance = upgrade.currency === 'revenue' ? run.economy.revenue : run.economy.output;
  if (balance < price) return reject(run, 'unaffordable');
  if (upgrade.pack === 'tokens') {
    // A consumable: code becomes tokens; there is no level and the card stays on offer.
    const pack = tokenPack(run, catalog);
    const bought: RunState = {
      ...run,
      cat: noteMeaningfulAction(run.cat),
      economy: {
        ...run.economy,
        output: roundAmount(run.economy.output - price),
        tokens: roundAmount(run.economy.tokens + pack.tokens),
      },
    };
    return {
      run: appendLog(
        bought,
        `🪙 Bought ${Math.round(pack.tokens)} tokens for ${Math.round(price)} code.`,
        catalog,
      ),
      facts: [{ type: 'purchased', id: upgrade.id }],
      result: 'applied',
    };
  }
  const bought: RunState = {
    ...run,
    cat: noteMeaningfulAction(run.cat),
    economy: { ...run.economy, [upgrade.currency]: roundAmount(balance - price) },
    upgradeLevels: { ...run.upgradeLevels, [upgrade.id]: level + 1 },
  };
  // The terminal answers every purchase; a discovery prints its own "unlocked" line instead.
  const announced = upgrade.discovers
    ? bought
    : appendLog(
        bought,
        `🛒 Bought ${upgrade.title}${upgrade.maxLevel > 1 ? ` (level ${level + 1})` : ''}.`,
        catalog,
      );
  const discovered = resolveDiscoveries(announced, catalog);
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
  const stats = { ...run.stats, manualActions: run.stats.manualActions + 1 };
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
    case 'optimize':
      economy = {
        ...economy,
        optimization: Math.min(
          catalog.balance.optimizeCap,
          roundAmount(economy.optimization + catalog.balance.optimizeStep),
        ),
      };
      break;
    case 'observe':
      // Nothing left to do by hand. The press is accepted and changes nothing.
      break;
    default: {
      const unknown: never = action;
      void unknown;
    }
  }
  return { run: { ...run, cat, economy, stats }, facts: [], result: 'applied' };
}
