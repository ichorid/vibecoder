import type { Catalog } from '../game/catalog';
import { balance } from './balance';
import { technologies } from './technologies';
import { upgrades } from './upgrades';

/** The authored game catalog, composed by app/ and passed to the simulation. */
export const catalog: Catalog = {
  balance,
  primaryActionLabels: { writeCode: 'WRITE CODE', prompt: 'PROMPT' },
  technologies,
  upgrades,
};
