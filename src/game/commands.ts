import type { Catalog } from './catalog';
import { deriveRates, roundAmount, upgradeLevel, upgradePrice } from './economy';
import { findUpgrade, isUpgradeOffered, resolveDiscoveries } from './progression';
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
  _activeTimestamp: number,
  catalog: Catalog,
): CommandTransition {
  if (run.status !== 'playing') return reject(run, 'unavailable');
  switch (command.type) {
    case 'primaryAction':
      return {
        run: {
          ...run,
          economy: {
            ...run.economy,
            pendingManualWork:
              run.economy.pendingManualWork + deriveRates(run, catalog).manualOutput,
          },
        },
        facts: [],
        result: 'applied',
      };
    case 'acknowledgeUnlock':
      if (!run.pendingUnlockIds.includes(command.id)) return reject(run, 'unavailable');
      return {
        run: { ...run, pendingUnlockIds: run.pendingUnlockIds.filter((id) => id !== command.id) },
        facts: [],
        result: 'applied',
      };
    case 'buyUpgrade':
      return buyUpgrade(run, command.id, catalog);
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
