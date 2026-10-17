/**
 * The corner plant: a tiny care toy with no effect on the economy. Water drains with active
 * time; tapping the plant waters it. Too much water drowns it, none dries it out; a dead plant
 * stays dead for the run (its death is told by the `plant-*` narrative events).
 */
import type { Catalog } from './catalog';
import { appendLog } from './log';
import type { RunState } from './types';

export type PlantLook = 'ok' | 'thirsty' | 'soggy' | 'dead';

export function plantLook(run: { readonly plant: RunState['plant'] }, catalog: Catalog): PlantLook {
  const { plant } = run;
  const b = catalog.balance.plant;
  if (!plant.alive) return 'dead';
  if (plant.water < b.thirstyBelow) return 'thirsty';
  if (plant.water > b.soggyAbove) return 'soggy';
  return 'ok';
}

/** The plant dies; its line (terminal and History) is a significant narrative event. */
function die(run: RunState, cause: 'drowned' | 'dried'): RunState {
  return { ...run, plant: { ...run.plant, alive: false, diedAtActiveMs: run.activeMs, cause } };
}

/** Drain water over `stepMs` of active time; warn once when thirsty; dry out at zero. */
export function updatePlant(run: RunState, stepMs: number, catalog: Catalog): RunState {
  if (!run.plant.alive || run.status !== 'playing') return run;
  const b = catalog.balance.plant;
  const water = run.plant.water - (b.drainPerMinute * stepMs) / 60_000;
  if (water <= 0) return die({ ...run, plant: { ...run.plant, water: 0 } }, 'dried');
  const next: RunState = { ...run, plant: { ...run.plant, water } };
  if (water < b.thirstyBelow && !run.plant.warned) {
    return appendLog(
      { ...next, plant: { ...next.plant, warned: true } },
      '🪴 The plant looks thirsty.',
      catalog,
    );
  }
  return next;
}

/** Water the plant: a dead one cannot be helped; too much drowns it. */
export function waterPlant(run: RunState, catalog: Catalog): RunState | null {
  if (!run.plant.alive) return null;
  const b = catalog.balance.plant;
  const water = run.plant.water + b.perWatering;
  const watered: RunState = { ...run, plant: { ...run.plant, water, warned: false } };
  return water > b.drownAbove ? die(watered, 'drowned') : watered;
}
