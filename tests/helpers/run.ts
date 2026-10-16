import { applyCommand } from '../../src/game/commands';
import type { Catalog } from '../../src/game/catalog';
import { stepRun } from '../../src/game/simulation';
import type { GameCommand, RunState } from '../../src/game/types';

/** Apply one command at the run's current active time and return the next run. */
export function act(run: RunState, command: GameCommand, catalog: Catalog): RunState {
  return applyCommand(run, command, run.activeMs, catalog).run;
}

/** Run `steps` ordinary 100 ms steps. */
export function steps(run: RunState, count: number, catalog: Catalog): RunState {
  let next = run;
  for (let i = 0; i < count; i += 1) next = stepRun(next, 100, catalog).run;
  return next;
}

/** Click the primary action `count` times, settling one step after each click. */
export function clickAndSettle(run: RunState, count: number, catalog: Catalog): RunState {
  let next = run;
  for (let i = 0; i < count; i += 1) {
    next = act(next, { type: 'primaryAction' }, catalog);
    next = steps(next, 1, catalog);
  }
  return next;
}
