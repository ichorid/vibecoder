import { deriveSeed } from './random';
import type { CatState, RunState } from './types';

/** Starting cat values from the design specification. */
export function createCat(): CatState {
  return {
    health: 100,
    mood: 85,
    fullness: 75,
    overfeeding: 0,
    alive: true,
    diedAtActiveMs: null,
  };
}

/** Seed and run ID come from app composition; game code never reads clocks or crypto. */
export function createRun(seed: number, runId: string): RunState {
  return {
    id: runId,
    status: 'playing',
    activeMs: 0,
    rng: {
      economy: deriveSeed(seed, 'economy'),
      cat: deriveSeed(seed, 'cat'),
      narrative: deriveSeed(seed, 'narrative'),
    },
    visualSeed: deriveSeed(seed, 'visual'),
    economy: { output: 0, pendingManualWork: 0 },
    stats: { lifetimeOutput: 0 },
    cat: createCat(),
    history: [],
    unlockedTechnologyIds: [],
    pendingUnlockIds: [],
    ending: null,
  };
}
