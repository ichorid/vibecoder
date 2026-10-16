import type { Catalog } from '../../src/game/catalog';

/** Minimal catalog with one manual action, for core ordering tests. */
export function createTestCatalog(): Catalog {
  return { balance: { manualOutputPerAction: 1 } };
}
