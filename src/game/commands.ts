import { spent } from './ledger';
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
import { designDemo, makeDemo } from './demos';
import { searchStep } from './gigs';
import { selectProject } from './projects';
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
  // The last landlord wheel can still be watched after an eviction ended the run.
  if (command.type === 'acknowledgeRentWheel' && run.rentWheelsSeen < run.rentWheels.length) {
    return {
      run: { ...run, rentWheelsSeen: run.rentWheelsSeen + 1 },
      facts: [],
      result: 'applied',
    };
  }
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
    case 'selectProject': {
      const selected = selectProject(run, command.id, catalog);
      if (!selected) return reject(run, 'unavailable');
      return {
        run: { ...selected.run, cat: noteMeaningfulAction(selected.run.cat) },
        facts: selected.facts,
        result: 'applied',
      };
    }
    case 'searchJob': {
      if (!run.gigs.search || run.job.employed) return reject(run, 'unavailable');
      return { run: searchStep(run, catalog), facts: [], result: 'applied' };
    }
    case 'acknowledgeNotice':
      if (run.notices.length === 0) return reject(run, 'unavailable');
      return { run: { ...run, notices: run.notices.slice(1) }, facts: [], result: 'applied' };
    case 'acknowledgeRentWheel':
      if (run.rentWheelsSeen >= run.rentWheels.length) return reject(run, 'unavailable');
      return {
        run: { ...run, rentWheelsSeen: run.rentWheelsSeen + 1 },
        facts: [],
        result: 'applied',
      };
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
    case 'designDemo': {
      const designed = designDemo(run, command.pick, catalog);
      if (!designed.accepted) return reject(run, 'unavailable');
      return { ...designed.transition, result: 'applied' };
    }
    case 'feedCat': {
      const fed = feedCat(run.cat, run.rng.cat, activeTimestamp, catalog.balance.cat);
      if (!fed.accepted) return reject(run, fed.reason);
      // After moving out the food costs money; feeding is never refused for it (it goes on debt).
      const food = run.rent.movedOut ? catalog.balance.rent.foodPerFeed : 0;
      return {
        run: {
          ...run,
          cat: fed.cat,
          rng: { ...run.rng, cat: fed.rng },
          stats: spent({ ...run.stats, feeds: run.stats.feeds + 1 }, 'food', food),
          economy: { ...run.economy, money: roundAmount(run.economy.money - food) },
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

/** Money buys things (tokens, compute, the company's cards); code-priced cards are projects. */
function buyUpgrade(run: RunState, id: string, catalog: Catalog): CommandTransition {
  const upgrade = findUpgrade(catalog, id);
  if (!upgrade || upgrade.currency !== 'money' || !isUpgradeOffered(run, upgrade)) {
    return reject(run, 'unavailable');
  }
  const level = upgradeLevel(run, upgrade.id);
  const price = offerPrice(run, upgrade, catalog);
  if (run.economy.money < price) return reject(run, 'unaffordable');
  if (upgrade.pack === 'tokens') {
    // A consumable: money becomes tokens; there is no level and the card stays on offer.
    const pack = tokenPack(run, catalog);
    const bought: RunState = {
      ...run,
      cat: noteMeaningfulAction(run.cat),
      economy: {
        ...run.economy,
        money: roundAmount(run.economy.money - price),
        tokens: roundAmount(run.economy.tokens + pack.tokens),
      },
      stats: spent(run.stats, 'shopping', price),
    };
    return {
      run: appendLog(
        bought,
        `🪙 Bought ${Math.round(pack.tokens)} tokens for $${Math.round(price)}.`,
        catalog,
      ),
      facts: [{ type: 'purchased', id: upgrade.id }],
      result: 'applied',
    };
  }
  const bought: RunState = {
    ...run,
    cat: noteMeaningfulAction(run.cat),
    economy: { ...run.economy, money: roundAmount(run.economy.money - price) },
    stats: spent(run.stats, 'shopping', price),
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

/** The current primary action: every press counts. */
function primaryAction(run: RunState, catalog: Catalog): CommandTransition {
  const cat = noteMeaningfulAction(run.cat);
  const rates = deriveRates(run, catalog);
  const action = currentPrimaryAction(run, catalog);
  let economy = run.economy;
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
