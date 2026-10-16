import { updateCat } from './cat';
import type { Catalog } from './catalog';
import { deriveRates, roundAmount } from './economy';
import { appendLog } from './log';
import type { GameFact, RunState } from './types';

export interface Transition {
  readonly run: RunState;
  readonly facts: readonly GameFact[];
}

/**
 * One fixed simulation step, applied in the architecture's order:
 * 1. active time, 2. production, (3. cat, 4. progression, 5. narrative/endings added later),
 * 6. facts for presentation. Never mutates its input.
 */
export function stepRun(run: RunState, stepMs: number, catalog: Catalog): Transition {
  if (run.status !== 'playing') return { run, facts: [] };
  const facts: GameFact[] = [];
  const activeMs = run.activeMs + stepMs;

  // 2. Production.
  const rates = deriveRates(run, catalog);
  const produced = roundAmount(
    run.economy.pendingManualWork + (rates.passiveOutputPerSecond * stepMs) / 1000,
  );
  let next: RunState = {
    ...run,
    activeMs,
    economy: {
      ...run.economy,
      output: roundAmount(run.economy.output + produced),
      pendingManualWork: 0,
    },
    stats: { ...run.stats, lifetimeOutput: roundAmount(run.stats.lifetimeOutput + produced) },
  };

  // 3. Cat needs, health and terminal death.
  const cat = updateCat(next.cat, stepMs, catalog.balance.cat);
  next = { ...next, cat: cat.cat };
  if (cat.events.some((event) => event.type === 'died')) next = recordDeath(next, catalog, facts);

  return { run: next, facts };
}

/** Atomic death transaction: death time, one History entry, one understated log line. */
function recordDeath(run: RunState, catalog: Catalog, facts: GameFact[]): RunState {
  facts.push({ type: 'catDied' });
  const dead: RunState = {
    ...run,
    cat: { ...run.cat, alive: false, health: 0, diedAtActiveMs: run.activeMs },
    history: [...run.history, { kind: 'cat', id: 'cat-died', activeMs: run.activeMs }],
  };
  return appendLog(dead, catalog.catText.conditions.dead, catalog);
}
