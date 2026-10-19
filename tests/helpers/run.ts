import { applyCommand } from '../../src/game/commands';
import type { Catalog } from '../../src/game/catalog';
import { catalog as content } from '../../src/content/catalog';
import { stepRun } from '../../src/game/simulation';
import { projectCode, projectPrice } from '../../src/game/projects';
import type { GameCommand, ProjectKey, RunState } from '../../src/game/types';

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

/** Click the primary action `count` times, settling one ordinary step after each click. */
export function clickAndSettle(run: RunState, count: number, catalog: Catalog): RunState {
  let next = run;
  for (let i = 0; i < count; i += 1) {
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

/**
 * Build a code project the real way (docs/feature_projects.md): pick it, put it on the first
 * slot (unit-test shortcut when the tap rule would choose another slot), then write exactly
 * the code it still needs by hand and settle one step, so it completes through the simulation.
 */
export function build(run: RunState, id: ProjectKey, catalog: Catalog): RunState {
  let next = act(run, { type: 'selectProject', id }, catalog);
  const slot = next.slots[0];
  if (slot && slot.target !== id) {
    next = { ...next, slots: [{ ...slot, target: id, by: 'player' }, ...next.slots.slice(1)] };
  }
  const price = projectPrice(next, id, catalog) ?? 0;
  const left = Math.max(0, price - projectCode(next, id));
  next = {
    ...next,
    economy: { ...next.economy, pendingManualWork: next.economy.pendingManualWork + left },
  };
  return steps(next, 1, catalog);
}

/** Give the run money (unit-test shortcut; money is a plain stock). */
export function withMoney(run: RunState, amount: number): RunState {
  return { ...run, economy: { ...run.economy, money: amount } };
}
