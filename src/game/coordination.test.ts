import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { act, steps } from '../../tests/helpers/run';
import { withTechnologies } from '../../tests/helpers/unlock';
import { createRun } from './createRun';
import { COORDINATION_FLOOR, coordinationEfficiency, deriveRates } from './economy';
import type { TechnologyId } from './ids';
import { selectGame } from './selectors';
import type { RunState } from './types';

const TO_REVIEWER: TechnologyId[] = [
  'autocomplete',
  'generated-snippets',
  'ai-native-ide',
  'terminal-agent',
  'autonomous-edits',
  'tool-permissions',
  'persistent-instructions',
  'ralph-loop',
  'reviewer',
];

function era(extra: TechnologyId[], patch: Partial<RunState['economy']> = {}): RunState {
  const run = withTechnologies(createRun(4, 'r'), [...TO_REVIEWER, ...extra], catalog);
  return { ...run, economy: { ...run.economy, tokens: 300, tasks: 40, ...patch } };
}

describe('parallel agents and coordination', () => {
  it('uses max(floor, min(1, managed / agents))', () => {
    expect(coordinationEfficiency(1, 1)).toBe(1);
    expect(coordinationEfficiency(2, 4)).toBeCloseTo(0.5, 9);
    expect(coordinationEfficiency(1, 3)).toBe(COORDINATION_FLOOR);
    expect(coordinationEfficiency(1, 50)).toBe(COORDINATION_FLOOR);
    expect(coordinationEfficiency(9, 3)).toBe(1);
  });

  it('adds agents but compute and coordination cap useful work', () => {
    const run = era(['parallel-agents']);
    const rates = deriveRates(run, catalog);
    expect(rates.agents).toBe(3);
    expect(rates.compute).toBe(1);
    expect(rates.managed).toBe(1);
    // Only one agent has compute; the purchase still raises potential work for later compute.
    const more = { ...run, upgradeLevels: { ...run.upgradeLevels, 'compute-slot': 2 } };
    const one = steps(run, 10, catalog);
    const three = steps(more, 10, catalog);
    // Three active agents but capacity to manage one: barely more useful output (the floor),
    // 3× the tokens.
    const gain = (r: typeof run) => r.stats.lifetimeOutput - run.stats.lifetimeOutput;
    expect(gain(three)).toBeLessThan(gain(one) * 3 * COORDINATION_FLOOR + 0.5);
    expect(run.economy.tokens - three.economy.tokens).toBeGreaterThan(
      2.5 * (run.economy.tokens - one.economy.tokens),
    );
    // Easing coordination (DELEGATE) turns the same compute into real output.
    const delegated = steps({ ...more, economy: { ...more.economy, delegation: 3 } }, 10, catalog);
    expect(delegated.stats.lifetimeOutput).toBeGreaterThan(one.stats.lifetimeOutput * 1.8);
  });

  it('worktrees and the manager ease coordination without multiplying everything', () => {
    const worktrees = deriveRates(era(['parallel-agents', 'worktrees']), catalog);
    expect(worktrees.managed).toBe(2);
    const manager = deriveRates(era(['parallel-agents', 'worktrees', 'manager-agent']), catalog);
    // The manager coordinates about 70 % of the agents it brings (+3).
    expect(manager.managed).toBe(5);
    expect(manager.workPerAgentPerSecond).toBe(worktrees.workPerAgentPerSecond);
  });

  it('DELEGATE adds bounded temporary management that decays', () => {
    let run = era(['parallel-agents']);
    expect(selectGame(run, catalog).primaryAction.label).toBe('DELEGATE');
    for (let i = 0; i < 6; i += 1) run = act(run, { type: 'primaryAction' }, catalog);
    expect(run.economy.delegation).toBe(catalog.balance.coordination.delegationCap);
    expect(deriveRates(run, catalog).managed).toBe(1 + catalog.balance.coordination.delegationCap);
    run = steps(run, 300, catalog);
    expect(run.economy.delegation).toBe(0);
  });

  it('SUPERVISE clears some debt per press within the action budget', () => {
    let run = era(['parallel-agents', 'worktrees', 'manager-agent'], { debt: 30 });
    expect(selectGame(run, catalog).primaryAction.label).toBe('SUPERVISE');
    run = act(run, { type: 'primaryAction' }, catalog);
    expect(run.economy.debt).toBe(30 - catalog.balance.coordination.supervisePerPress);
    for (let i = 0; i < 30; i += 1) run = act(run, { type: 'primaryAction' }, catalog);
    expect(run.economy.debt).toBe(
      30 - catalog.balance.actionBurst * catalog.balance.coordination.supervisePerPress,
    );
  });
});

describe('repeatable upgrades', () => {
  it('shows the progression card, the choice, then the card for what binds, at most three', () => {
    const run = era(['parallel-agents'], { tokens: 0 });
    const ids = selectGame(run, catalog).offers.map((o) => o.id);
    expect(ids).toEqual(['worktrees', 'keep-manual', 'token-supply']);
  });
});
