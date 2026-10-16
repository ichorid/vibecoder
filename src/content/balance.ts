import type {
  AttentionBalance,
  BalanceDefinition,
  CatBalance,
  CatPlayBalance,
} from '../game/catalog';

/** Cat starting values (architecture §6, implementation plan §6). */
export const catBalance = {
  needsTickMs: 5000,
  fullnessDecayPerTick: 0.65,
  moodDecayPerTick: 0.45,
  accelerationPerAction: 0.01,
  accelerationCap: 0.1,
  hungryBelow: 35,
  lonelyBelow: 70,
  attentionBelow: 40,
  overfedAt: 40,
  sickAt: 80,
  criticalBelow: 20,
  starvationBelow: 20,
  starvationHealthPerMinute: 8,
  severeStarvationAtOrBelow: 5,
  severeStarvationHealthPerMinute: 14,
  recoveryAbove: 35,
  recoveryHealthPerMinute: 4,
  overfeedingDecayPerMinute: 6,
  sicknessMoodPerMinute: 1,
  sicknessHealthPerMinute: 2,
  sicknessHealthFloor: 10,
  feedMin: 18,
  feedMax: 32,
  feedLockMs: 1000,
  overfeedPressure: 25,
  overfeedFullnessAt: 85,
  overfeedOverflowAt: 10,
  petMood: 3,
  petCooldownMs: 60_000,
} as const satisfies CatBalance;

/** Starting balance values (implementation plan §6). Tune with tests and a recorded reason. */
/** PLAY starting values (implementation plan §6, phase P05). Do not raise difficulty before a mobile playtest. */
export const catPlayBalance = {
  attempts: 3,
  readyMs: 300,
  movementMs: 4000,
  resultMs: 300,
  resumeCueMs: 500,
  targetWidthMin: 0.15,
  targetWidthMax: 0.3,
  speedMin: 0.4,
  speedMax: 0.75,
  minHitWindowMs: 200,
  nearMissDistance: 0.03,
  hitMoodMin: 8,
  hitMoodMax: 12,
  nearMissMood: 1,
} as const satisfies CatPlayBalance;

/** Attention intrusions (implementation plan §6). */
export const attentionBalance = {
  smallBelowMood: 40,
  largeBelowMood: 20,
  smallIntervalMs: 45_000,
  smallDurationMs: 4000,
  largeIntervalMs: 25_000,
  largeDurationMs: 6000,
} as const satisfies AttentionBalance;

export const balance = {
  minTokenCostPerWork: 0.1,
  optimizeStep: 0.05,
  optimizeCap: 0.25,
  optimizeDecayPerSecond: 0.01,
  coordination: {
    baseManaged: 1,
    delegationCap: 3,
    delegationDecayPerSecond: 0.1,
    supervisePerPress: 2,
  },
  actionBurst: 10,
  actionRefillPerSecond: 10,
  agents: { taskQueueCap: 60, tokenReserve: 150, tokenReserveSupplySeconds: 60 },
  cat: catBalance,
  catPlay: catPlayBalance,
  attention: attentionBalance,
  manualOutputPerAction: 1,
  logMemoryLimit: 50,
  logVisibleLines: 5,
} as const satisfies BalanceDefinition;
