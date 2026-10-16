import type { Catalog } from './catalog';
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
              run.economy.pendingManualWork + catalog.balance.manualOutputPerAction,
          },
        },
        facts: [],
        result: 'applied',
      };
    default: {
      const unknownCommand: never = command.type;
      void unknownCommand;
      return reject(run, 'unavailable');
    }
  }
}
