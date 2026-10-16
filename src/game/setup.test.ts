import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { createRun } from './createRun';
import { stepRun } from './simulation';
import { selectSetup, upgradeImpact } from './setup';
import type { RunState } from './types';
import type { TechnologyId } from './ids';

function at(last: TechnologyId, patch: Partial<RunState['economy']> = {}): RunState {
  const ids = catalog.technologies.map((t) => t.id);
  const owned = ids.slice(0, ids.indexOf(last) + 1);
  const run = createRun(3, 'setup');
  return {
    ...run,
    unlockedTechnologyIds: owned,
    upgradeLevels: Object.fromEntries(owned.map((id) => [id, 1])),
    history: owned.map((id) => ({ kind: 'technology' as const, id, activeMs: 0 })),
    economy: { ...run.economy, tokens: 1000, tasks: 60, ...patch },
  };
}

describe('setup view', () => {
  it('lists the technologies applied so far, in unlock order, with their effects', () => {
    const setup = selectSetup(at('ai-native-ide'), catalog);
    expect(setup.technologies.map((t) => t.id)).toEqual([
      'autocomplete',
      'generated-snippets',
      'ai-native-ide',
    ]);
    expect(setup.technologies[2]?.effects).toEqual(['+1 code/s', 'action → PROMPT']);
  });

  it('shows stacked upgrades with their level and total effect', () => {
    const run = at('parallel-agents');
    const stacked = {
      ...run,
      upgradeLevels: { ...run.upgradeLevels, 'compute-slot': 3, 'token-review': 2 },
    };
    const setup = selectSetup(stacked, catalog);
    expect(setup.stacked.find((s) => s.id === 'compute-slot')).toMatchObject({
      level: 3,
      maxLevel: 8,
      effects: ['+3 compute'],
    });
    expect(setup.stacked.find((s) => s.id === 'token-review')?.effects).toEqual([
      '+20% tokens per code',
    ]);
    expect(setup.stacked.some((s) => s.id === 'additional-agent')).toBe(false);
  });

  it('breaks the economy down per second, matching what one simulation step produces', () => {
    const run = at('reviewer');
    const setup = selectSetup(run, catalog);
    const e = setup.economy;
    expect(e.runnableAgents).toBe(1);
    expect(e.usefulCodePerSecond).toBeCloseTo(
      e.fundedWorkPerSecond * e.coordination * e.quality * e.efficiency,
      6,
    );
    const next = stepRun(
      { ...run, economy: { ...run.economy, pendingManualWork: 0 } },
      100,
      catalog,
    ).run;
    expect((next.economy.output - run.economy.output) * 10).toBeCloseTo(e.totalCodePerSecond, 1);
  });

  it('names what holds production back', () => {
    expect(selectSetup(at('ai-native-ide'), catalog).limits).toEqual(['manual']);
    // Before passive tasks exist, an empty queue starves the agent.
    expect(selectSetup(at('autonomous-edits', { tasks: 0 }), catalog).limits).toContain('tasks');
    expect(selectSetup(at('reviewer', { tokens: 0 }), catalog).limits).toContain('tokens');
    const crowded = at('parallel-agents');
    const busy = { ...crowded, upgradeLevels: { ...crowded.upgradeLevels, 'additional-agent': 3 } };
    expect(selectSetup(busy, catalog).limits).toContain('compute');
  });

  it('says what a press of the main button does, including when it does nothing', () => {
    expect(selectSetup(at('autocomplete'), catalog).economy.pressEffect).toBe('+2 code');
    expect(selectSetup(at('manager-agent'), catalog).economy.pressEffect).toBe('−2 debt');
    expect(selectSetup(at('autonomous-company'), catalog).economy.pressEffect).toMatch(/^nothing/);
  });

  it('each card shows its effect on the economy right now', () => {
    // 3 agents, 2 compute, plenty of management: one more compute slot puts the idle agent
    // to work. (With a single manager the gain would be zero: coordination would halve.)
    const run = at('manager-agent');
    const card = (id: string) => catalog.upgrades.find((u) => u.id === id);
    const compute = card('compute-slot');
    const reviewer = card('review-capacity');
    if (!compute || !reviewer) throw new Error('missing cards');
    expect(upgradeImpact(run, compute, catalog)?.codePerSecond).toBeGreaterThan(1);
    expect(upgradeImpact(run, reviewer, catalog)?.debtPerSecond).toBeCloseTo(-0.5, 6);
    const pack = card('token-supply');
    if (!pack) throw new Error('no pack');
    expect(upgradeImpact(run, pack, catalog)).toBeNull();
  });
});
