import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { createRun } from './createRun';
import type { TechnologyId } from './ids';
import { selectGame } from './selectors';
import type { RunState } from './types';

/** A run at `last` with plenty of code and tokens (no recovery card in the way). */
function at(last: TechnologyId, patch: Partial<RunState> = {}): RunState {
  const ids = catalog.technologies.map((t) => t.id);
  const owned = ids.slice(0, ids.indexOf(last) + 1);
  const run = createRun(3, 'relevance');
  return {
    ...run,
    unlockedTechnologyIds: owned,
    upgradeLevels: Object.fromEntries(owned.map((id) => [id, 1])),
    history: owned.map((id) => ({ kind: 'technology' as const, id, activeMs: 0 })),
    economy: { ...run.economy, output: 1e6, tokens: 1e9, tasks: 60 },
    ...patch,
  };
}
const optional = (run: RunState) =>
  selectGame(run, catalog)
    .offers.filter(
      (o) => o.kind === 'upgrade' && !catalog.upgrades.find((u) => u.id === o.id)?.discovers,
    )
    .map((o) => o.id);

describe('optional cards ranked by what binds now', () => {
  it('agents idle without compute: the compute slot comes first', () => {
    // Parallel agents: 3 agents, 1 compute.
    expect(optional(at('parallel-agents'))[0]).toBe('compute-slot');
  });

  it('agents bind, enough managers and no debt worry: an additional agent comes first', () => {
    const run = at('manager-agent');
    const roomy = { ...run, upgradeLevels: { ...run.upgradeLevels, 'compute-slot': 6 } };
    expect(optional(roomy)[0]).toBe('additional-agent');
  });

  it('debt above 20: the code reviewer comes first', () => {
    const run = at('manager-agent');
    const indebted = {
      ...run,
      upgradeLevels: { ...run.upgradeLevels, 'compute-slot': 6 },
      economy: { ...run.economy, debt: 40 },
    };
    expect(optional(indebted)[0]).toBe('review-capacity');
  });
});
