import type { BalanceDefinition } from '../game/catalog';

/** Starting balance values (implementation plan §6). Tune with tests and a recorded reason. */
export const balance = {
  manualOutputPerAction: 1,
  logMemoryLimit: 50,
  logVisibleLines: 5,
} as const satisfies BalanceDefinition;
