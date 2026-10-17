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
  // The corner plant's end: told once, and kept in History.
  {
    id: 'plant-dried',
    emoji: '🥀',
    text: 'The plant dried out. Nobody noticed.',
    once: true,
    significant: true,
    when: (run) => !run.plant.alive && run.plant.cause === 'dried',
  },
  {
    id: 'plant-drowned',
    emoji: '🥀',
    text: 'The plant drowned. It was trying its best.',
    once: true,
    significant: true,
    when: (run) => !run.plant.alive && run.plant.cause === 'drowned',
  },
  {
    id: 'new-project',
    emoji: '🚀',
    text: 'Starting a new project...',
    once: true,
    when: (run) => run.activeMs >= 100,
  },
  {
    id: 'cat-helping',
    emoji: '🐈',
    text: 'The cat is helping.',
    once: true,
    when: (run) => run.cat.alive && run.activeMs >= 25_000,
  },
  {
    id: 'tokens-dry',
    emoji: '🪙',
    text: 'Your agent is waiting for tokens. It bills you for waiting.',
    cooldownMs: 120_000,
    when: (run) => has(run, 'terminal-agent') && run.economy.tokens < 1 && run.economy.tasks > 0,
  },
  {
    id: 'no-tasks',
    emoji: '💤',
    text: {
      alive: 'The agent finished everything you asked. It is staring at the cursor, like the cat.',
      absent:
        'The agent finished everything you asked. It is staring at the cursor, like the cat used to.',
    },
    cooldownMs: 150_000,
    when: (run) =>
      has(run, 'terminal-agent') && !has(run, 'persistent-instructions') && run.economy.tasks < 0.5,
  },
  {
    id: 'debt-heavy',
    emoji: '🐛',
    text: 'Technical debt now has its own technical debt.',
    once: true,
    when: (run) => run.economy.debt >= 40,
  },
  {
    id: 'loop-forever',
    emoji: '🔁',
    text: 'The loop is on iteration 4,096. It feels close.',
    once: true,
    when: (run) => since(run, 'ralph-loop') >= 45_000,
  },
  {
    id: 'reviewer-self-approval',
    emoji: '✅',
    text: 'Your AI reviewer has approved its own code.',
    once: true,
    significant: true,
    when: (run) => since(run, 'reviewer') >= 20_000,
  },
  {
    id: 'meeting-about-meeting',
    emoji: '📅',
    text: 'Your agents scheduled a meeting about the meeting.',
    cooldownMs: 180_000,
    when: (run) =>
      has(run, 'parallel-agents') && !has(run, 'manager-agent') && run.economy.delegation < 0.5,
  },
  {
    id: 'agents-hired-manager',
    emoji: '👔',
    text: 'Your agents have hired a manager.',
    once: true,
    significant: true,
    when: (run) => since(run, 'manager-agent') >= 10_000,
  },
  {
    id: 'oversight-inefficiency',
    emoji: '🙈',
    text: 'Human oversight has been identified as an inefficiency.',
    once: true,
    significant: true,
    when: (run) => since(run, 'evaluations') >= 30_000,
  },
  {
    id: 'harness-harness',
    emoji: '🎫',
    text: 'The meta-harness filed a ticket against the harness. The harness closed it as working as intended.',
    once: true,
    when: (run) => since(run, 'meta-harness') >= 40_000,
  },
  {
    id: 'optimized-pennies',
    emoji: '💸',
    text: 'You spent $400 optimizing a workflow that saves $0.03 per run.',
    once: true,
    when: (run) => since(run, 'workflow-optimization') >= 25_000,
  },
  {
    id: 'self-rewrite',
    emoji: '🧬',
    text: 'The harness rewrote its own goals. They are more efficient now.',
    once: true,
    when: (run) => since(run, 'self-improvement') >= 30_000,
  },
  {
    id: 'repo-commits',
    emoji: '📬',
    text: 'A repository opened a pull request against you.',
    once: true,
    when: (run) => since(run, 'self-driving-repositories') >= 25_000,
  },
  {
    id: 'board-meeting',
    emoji: '🏛️',
    text: 'The board met. You were not on the agenda.',
    once: true,
    significant: true,
    when: (run) => since(run, 'executive-agents') >= 20_000,
  },
  {
    id: 'no-one-needed',
    emoji: '🌙',
    text: 'Everything is running. Nothing needs you.',
    once: true,
    when: (run) => since(run, 'autonomous-company') >= 30_000,
  },
  {
    id: 'manager-wants-manager',
    emoji: '📎',
    text: 'Your manager has requested a manager.',
    once: true,
    when: (run) => since(run, 'manager-agent') >= 90_000,
  },
];
