import { applyCommand } from '../../src/game/commands';
import type { Catalog } from '../../src/game/catalog';
import { catalog as content } from '../../src/content/catalog';
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

/**
 * Click the primary action `count` times so that every click counts: before each one, wait
 * (in ordinary steps) until the tap budget has a charge, then settle one step after it.
 */
export function clickAndSettle(run: RunState, count: number, catalog: Catalog): RunState {
  let next = run;
  for (let i = 0; i < count; i += 1) {
    while (next.economy.actionCharges < 1) next = steps(next, 1, catalog);
    next = act(next, { type: 'primaryAction' }, catalog);
    next = steps(next, 1, catalog);
  }
  return next;
}

const priceOf = (id: string) => content.upgrades.find((u) => u.id === id)?.basePrice ?? 0;
/** What the first three cards cost (a press writes 1 code, then 2, then 4). */
export const AUTOCOMPLETE_PRICE = priceOf('autocomplete');
export const SNIPPETS_PRICE = priceOf('generated-snippets');
export const IDE_PRICE = priceOf('ai-native-ide');
