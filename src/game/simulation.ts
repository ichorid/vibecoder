import type { Catalog } from './catalog';
import { deriveRates, roundAmount } from './economy';
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
  const rates = deriveRates(run, catalog);
  const produced = roundAmount(
    run.economy.pendingManualWork + (rates.passiveOutputPerSecond * stepMs) / 1000,
  );
  return {
    run: {
      ...run,
      activeMs: run.activeMs + stepMs,
      economy: {
        ...run.economy,
        output: roundAmount(run.economy.output + produced),
        pendingManualWork: 0,
      },
      stats: { ...run.stats, lifetimeOutput: roundAmount(run.stats.lifetimeOutput + produced) },
    },
    facts: [],
  };
}
