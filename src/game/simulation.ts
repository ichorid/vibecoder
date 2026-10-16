import type { Catalog } from './catalog';
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
export function stepRun(run: RunState, stepMs: number, _catalog: Catalog): Transition {
  if (run.status !== 'playing') return { run, facts: [] };
  const produced = run.economy.pendingManualWork;
  return {
    run: {
      ...run,
      activeMs: run.activeMs + stepMs,
      economy: { ...run.economy, output: run.economy.output + produced, pendingManualWork: 0 },
      stats: { ...run.stats, lifetimeOutput: run.stats.lifetimeOutput + produced },
    },
    facts: [],
  };
}
