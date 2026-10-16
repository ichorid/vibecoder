/**
 * Early narrative lines (humorous, slowly more ominous later). Predicates read plain run data
 * only; content never imports simulation code.
 */
import type { EventDefinition } from '../game/catalog';
import type { ReadonlyRun } from '../game/types';

const has = (run: ReadonlyRun, id: string) =>
  (run.unlockedTechnologyIds as readonly string[]).includes(id);
const since = (run: ReadonlyRun, id: string) => {
  const entry = run.history.find((e) => e.kind === 'technology' && e.id === id);
  return entry ? run.activeMs - entry.activeMs : -1;
};

export const events: readonly EventDefinition[] = [
  {
    id: 'new-project',
    text: 'Starting a new project...',
    once: true,
    when: (run) => run.activeMs >= 100,
  },
  {
    id: 'cat-helping',
    text: 'The cat is helping.',
    once: true,
    when: (run) => run.cat.alive && run.activeMs >= 25_000,
  },
  {
    id: 'tokens-dry',
    text: 'Your agent is waiting for tokens. It bills you for waiting.',
    cooldownMs: 120_000,
    when: (run) => has(run, 'terminal-agent') && run.economy.tokens < 1 && run.economy.tasks > 0,
  },
  {
    id: 'no-tasks',
    text: 'The agent finished everything you asked. It is staring at the cursor, like the cat.',
    cooldownMs: 150_000,
    when: (run) =>
      has(run, 'terminal-agent') && !has(run, 'persistent-instructions') && run.economy.tasks < 0.5,
  },
  {
    id: 'debt-heavy',
    text: 'Technical debt now has its own technical debt.',
    once: true,
    when: (run) => run.economy.debt >= 40,
  },
  {
    id: 'loop-forever',
    text: 'The loop is on iteration 4,096. It feels close.',
    once: true,
    when: (run) => since(run, 'ralph-loop') >= 45_000,
  },
  {
    id: 'reviewer-self-approval',
    text: 'Your AI reviewer has approved its own code.',
    once: true,
    significant: true,
    when: (run) => since(run, 'reviewer') >= 20_000,
  },
  {
    id: 'meeting-about-meeting',
    text: 'Your agents scheduled a meeting about the meeting.',
    cooldownMs: 180_000,
    when: (run) =>
      has(run, 'parallel-agents') && !has(run, 'manager-agent') && run.economy.delegation < 0.5,
  },
  {
    id: 'agents-hired-manager',
    text: 'Your agents have hired a manager.',
    once: true,
    significant: true,
    when: (run) => since(run, 'manager-agent') >= 10_000,
  },
  {
    id: 'manager-wants-manager',
    text: 'Your manager has requested a manager.',
    once: true,
    when: (run) => since(run, 'manager-agent') >= 90_000,
  },
];
