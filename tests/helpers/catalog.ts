import { attentionBalance, balance, catBalance, catPlayBalance } from '../../src/content/balance';
import { catText } from '../../src/content/catText';
import { releases } from '../../src/content/releases';
import type { Catalog } from '../../src/game/catalog';

/** Minimal catalog with one manual action, for core ordering tests. */
export function createTestCatalog(): Catalog {
  return {
    choices: [],
    endings: [],
    events: [],
    achievements: [],
    releases: { ...releases, windows: [] },

    catText,
    balance: {
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
      agents: { taskQueueCap: 40, tokenReserve: 150, tokenReserveSupplySeconds: 60 },
      cat: catBalance,
      catPlay: catPlayBalance,
      attention: attentionBalance,
      tokens: balance.tokens,
      manualOutputPerAction: 1,
      logMemoryLimit: 50,
      logVisibleLines: 5,
    },
    primaryActionLabels: {
      writeCode: 'WRITE CODE',
      prompt: 'PROMPT',
      delegate: 'DELEGATE',
      supervise: 'SUPERVISE',
      optimize: 'OPTIMIZE',
      observe: 'OBSERVE',
    },
    statLabels: {
      output: 'Code',
      tokens: 'Tokens',
      debt: 'Debt',
      automation: 'Automation',
      revenue: 'Revenue',
      margin: 'Margin',
    },
    technologies: [],
    upgrades: [],
  };
}
