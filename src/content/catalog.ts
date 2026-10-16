import type { Catalog } from '../game/catalog';
import { balance } from './balance';
import { catText } from './catText';
import { events } from './events';
import { technologies } from './technologies';
import { upgrades } from './upgrades';

/** The authored game catalog, composed by app/ and passed to the simulation. */
export const catalog: Catalog = {
  balance,
  catText,
  events,
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
  technologies,
  upgrades,
};
