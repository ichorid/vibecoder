import { catBalance } from '../../src/content/balance';
import { catText } from '../../src/content/catText';
import type { Catalog } from '../../src/game/catalog';

/** Minimal catalog with one manual action, for core ordering tests. */
export function createTestCatalog(): Catalog {
  return {
    catText,
    balance: { cat: catBalance, manualOutputPerAction: 1, logMemoryLimit: 50, logVisibleLines: 5 },
    primaryActionLabels: { writeCode: 'WRITE CODE', prompt: 'PROMPT' },
    technologies: [],
    upgrades: [],
  };
}
