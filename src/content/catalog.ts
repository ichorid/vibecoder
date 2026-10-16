import type { Catalog } from '../game/catalog';
import { achievements } from './achievements';
import { balance } from './balance';
import { catText } from './catText';
import { chatter } from './chatter';
import { choices, endings } from './endings';
import { events } from './events';
import { releases } from './releases';
import { technologies } from './technologies';
import { upgrades } from './upgrades';

/** The authored game catalog, composed by app/ and passed to the simulation. */
export const catalog: Catalog = {
  balance,
  catText,
  chatter,
  choices,
  endings,
  releases,
  events,
  achievements,
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
    quality: 'Quality',
    team: 'Team',
  },
  technologies,
  upgrades,
};
