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
    leftAtActiveMs: null,
    ignoredMs: 0,
    needsElapsedMs: 0,
    pendingActions: 0,
    lastFedAtActiveMs: null,
    lastPetAtActiveMs: null,
    lastCare: null,
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
    economy: {
      output: 0,
      pendingManualWork: 0,
      tokens: 0,
      tasks: 0,
      actionCharges: 10,
      debt: 0,
      delegation: 0,
      optimization: 0,
      revenue: 0,
      revenuePerSecond: 0,
      costPerSecond: 0,
      autoRefills: 0,
      tokenReviewBonus: 0,
      autoReviewMs: 0,
      tokenDemandPerSecond: 0,
    },
    stats: {
      lifetimeOutput: 0,
      feeds: 0,
      pets: 0,
      playHits: 0,
      manualActions: 0,
      lowDebtMs: 0,
      positiveMarginMs: 0,
      negativeMarginMs: 0,
      refillDisasters: 0,
    },
    cat: createCat(),
    history: [],
    log: [],
    unlockedTechnologyIds: [],
    upgradeLevels: {},
    achievementIds: [],
    pendingUnlockIds: [],
    catPlay: null,
    narrative: { fired: [], lastAt: {} },
    attention: { nextAtMs: null, visibleUntilMs: null, level: null, count: 0 },
    catPlaySeq: 0,
    choices: {},
    ending: null,
  };
}
