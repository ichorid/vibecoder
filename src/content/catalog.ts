import type { Catalog } from '../game/catalog';
import { achievements } from './achievements';
import { balance } from './balance';
import { catText } from './catText';
import { chatter } from './chatter';
import { demos } from './demos';
import { choices, endings } from './endings';
import { events } from './events';
import { money } from './money';
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
  demos,
  money,
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
    code: 'Code/s',
    tokens: 'Tokens',
    debt: 'Debt',
    automation: 'Automation',
    money: '$',
    margin: 'Margin',
    quality: 'Quality',
    team: 'Team',
  },
  technologies,
  upgrades,
};
