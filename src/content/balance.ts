import type { BalanceDefinition, CatBalance } from '../game/catalog';

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
export const balance = {
  cat: catBalance,
  manualOutputPerAction: 1,
  logMemoryLimit: 50,
  logVisibleLines: 5,
} as const satisfies BalanceDefinition;
