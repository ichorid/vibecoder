/** Discovered-only records. Titles appear in History once earned; nothing is listed before. */
import type { AchievementDefinition } from '../game/catalog';
import type { ReadonlyRun } from '../game/types';

const has = (run: ReadonlyRun, id: string) =>
  (run.unlockedTechnologyIds as readonly string[]).includes(id);

export const achievements: readonly AchievementDefinition[] = [
  { id: 'hired-a-process', title: 'Hired a process', when: (run) => has(run, 'terminal-agent') },
  {
    id: 'debt-collector',
    title: 'Debt collector (100 technical debt)',
    when: (run) => run.economy.debt >= 100,
  },
  {
    id: 'good-hands',
    title: 'Good hands: petted the cat ten times',
    when: (run) => run.stats.pets >= 10,
  },
  {
    id: 'mouse-hunter',
    title: 'Mouse hunter: ten perfect pounces',
    when: (run) => run.stats.playHits >= 10,
  },
  {
    id: 'self-reviewed',
    title: 'Approved by yourself',
    when: (run) => run.narrative.fired.includes('reviewer-self-approval'),
  },
  {
    id: 'fully-automated',
    title: 'Nothing left to do by hand',
    when: (run) => has(run, 'autonomous-company'),
  },
  {
    id: 'first-release',
    title: 'Shipped it (three users, probably)',
    when: (run) => run.releases.length >= 1,
  },
  {
    id: 'serial-shipper',
    title: 'Serial shipper: five releases',
    when: (run) => run.releases.length >= 5,
  },
  {
    id: 'still-purring',
    title: 'Still purring at the end of everything',
    when: (run) => has(run, 'autonomous-company') && run.cat.alive,
  },
];
