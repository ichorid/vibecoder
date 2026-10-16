import type { Catalog } from '../../src/game/catalog';

/** Minimal catalog with one manual action, for core ordering tests. */
export function createTestCatalog(): Catalog {
  return {
    balance: { manualOutputPerAction: 1, logMemoryLimit: 50, logVisibleLines: 5 },
    primaryActionLabels: { writeCode: 'WRITE CODE', prompt: 'PROMPT' },
    technologies: [],
    upgrades: [],
  };
}
