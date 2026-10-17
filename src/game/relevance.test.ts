import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { createRun } from './createRun';
import { deriveRates } from './economy';
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
    economy: { ...run.economy, money: 1e6, tokens: 1e9, tasks: 60 },
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

describe('capacity: the card that adds the most now, or the scarcest of the three', () => {
  it('coordination binds (three agents running, one managed): the reviewer comes first', () => {
    const run = at('parallel-agents');
    const roomy = { ...run, upgradeLevels: { ...run.upgradeLevels, 'compute-slot': 2 } };
    expect(deriveRates(roomy, catalog).managed).toBe(1);
    expect(optional(roomy)[0]).toBe('review-capacity');
  });

  it('every agent has compute and a manager: another agent first, though alone it waits', () => {
    const run = at('manager-agent');
    const rates = deriveRates(run, catalog);
    const full = {
      ...run,
      upgradeLevels: { ...run.upgradeLevels, 'compute-slot': rates.agents - rates.compute },
    };
    expect(deriveRates(full, catalog).compute).toBe(rates.agents);
    expect(rates.managed).toBeGreaterThanOrEqual(rates.agents);
    expect(optional(full)[0]).toBe('additional-agent');
  });

  it('the first capacity card on offer is the best code per code spent when one helps', () => {
    for (const last of ['manager-agent', 'local-servers', 'custom-harness'] as const) {
      const offers = selectGame(at(last), catalog).offers.flatMap((o) =>
        o.kind === 'upgrade' && catalog.upgrades.find((u) => u.id === o.id)?.priceRule ? [o] : [],
      );
      const helping = offers.filter((o) => (o.impact?.codePerSecond ?? 0) > 0);
      if (helping.length === 0) continue;
      const value = (o: (typeof offers)[number]) => (o.impact?.codePerSecond ?? 0) / o.price;
      expect(offers[0]?.id, last).toBe([...helping].sort((a, b) => value(b) - value(a))[0]?.id);
    }
  });
});
