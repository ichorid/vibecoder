import type {
  AttentionBalance,
  BalanceDefinition,
  CatBalance,
  CatPlayBalance,
} from '../game/catalog';

/**
 * How demanding the cat is. Every time-based cat rate is multiplied by this factor and the PET
 * cooldown divided by it, while what one action gives (a meal, a pet, a caught mouse) is
 * unchanged — so keeping the cat well takes this many times more care actions. 1 = the original
 * plan values (feed every 3–4 min, PLAY every 4–6 min); 3 = feed about every minute.
 */
export const CAT_INTENSITY = 3;
const perMinute = (value: number) => value * CAT_INTENSITY;

/** Cat starting values (architecture §6, implementation plan §6), scaled by `CAT_INTENSITY`. */
export const catBalance = {
  needsTickMs: 5000,
  fullnessDecayPerTick: perMinute(0.65),
  moodDecayPerTick: perMinute(0.45),
  accelerationPerAction: 0.01,
  accelerationCap: 0.1,
  hungryBelow: 35,
  lonelyBelow: 70,
  attentionBelow: 40,
  overfedAt: 40,
  sickAt: 80,
  criticalBelow: 20,
  starvationBelow: 20,
  starvationHealthPerMinute: perMinute(8),
  severeStarvationAtOrBelow: 5,
  severeStarvationHealthPerMinute: perMinute(14),
  recoveryAbove: 35,
  recoveryHealthPerMinute: perMinute(4),
  overfeedingDecayPerMinute: perMinute(6),
  sicknessMoodPerMinute: perMinute(1),
  sicknessHealthPerMinute: perMinute(2),
  sicknessHealthFloor: 10,
  feedMin: 18,
  feedMax: 32,
  feedLockMs: 1000,
  overfeedPressure: 25,
  overfeedFullnessAt: 85,
  overfeedOverflowAt: 10,
  petMood: 3,
  petCooldownMs: 60_000 / CAT_INTENSITY,
  // 24 minutes of begging at the original pace; at ×3 a fed cat nobody plays with leaves ~minute 11.
  strayAfterIgnoredMs: (24 * 60_000) / CAT_INTENSITY,
} as const satisfies CatBalance;

/** Starting balance values (implementation plan §6). Tune with tests and a recorded reason. */
/** PLAY starting values (implementation plan §6, phase P05). Do not raise difficulty before a mobile playtest. */
export const catPlayBalance = {
  attempts: 3,
  readyMs: 300,
  movementMs: 4000,
  // The pause after a catch or a timeout; CATCH during it skips straight to the next attempt.
  resultMs: 500,
  skipLockMs: 150,
  resumeCueMs: 500,
  targetWidthMin: 0.15,
  targetWidthMax: 0.3,
  speedMin: 0.4,
  speedMax: 0.75,
  minHitWindowMs: 200,
  // A session escalates: each next mouse is 15 % faster and its band 15 % narrower.
  attemptSpeedFactor: 1.15,
  attemptWidthFactor: 0.85,
  nearMissDistance: 0.03,
  hitMoodMin: 8,
  hitMoodMax: 12,
  nearMissMood: 1,
} as const satisfies CatPlayBalance;

/** Attention intrusions (implementation plan §6). */
export const attentionBalance = {
  smallBelowMood: 40,
  largeBelowMood: 20,
  quietBelowHealth: catBalance.criticalBelow,
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
  chatter: { minGapMs: 30_000, maxGapMs: 60_000, newestCount: 3, newestWeight: 3 },
  // Running at a loss borrows up to 3 minutes of costs, at 0.2 % interest per second.
  money: { creditSeconds: 180, interestPerSecond: 0.002 },
  tokens: {
    perCodeBase: 6,
    packSeconds: 60,
    packMin: 300,
    // Auto-refill waits until the tokens are gone (the agents do stall for a moment).
    refillBelowTokens: 1,
    // The bug pays for a pack that never arrives: half the current code, zero tokens.
    disasterLoss: 0.5,
    firstDisasterFrom: 3,
    firstDisasterTo: 6,
    laterDisasterChance: 0.15,
    reviewStep: 0.1,
    autoReviewEveryMs: 30_000,
    autoReviewStep: 0.02,
    autoReviewCap: 0.5,
  },
} as const satisfies BalanceDefinition;
