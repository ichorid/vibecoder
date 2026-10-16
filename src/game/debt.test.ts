import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { act, steps } from '../../tests/helpers/run';
import { withTechnologies } from '../../tests/helpers/unlock';
import { createRun } from './createRun';
import { deriveRates, QUALITY_FLOOR, qualityEfficiency } from './economy';
import type { TechnologyId } from './ids';
import type { RunState } from './types';

const BASE = ['autocomplete', 'generated-snippets', 'ai-native-ide', 'terminal-agent'] as const;

function era(extra: readonly TechnologyId[], patch: Partial<RunState['economy']> = {}): RunState {
  const run = withTechnologies(createRun(9, 'r'), [...BASE, ...extra], catalog);
  return { ...run, economy: { ...run.economy, tokens: 200, tasks: 40, ...patch } };
}

describe('technical debt and review', () => {
  it('accrues no debt before autonomous edits', () => {
    expect(steps(era([]), 50, catalog).economy.debt).toBe(0);
  });

  it('accrues debt from unchecked agent work, halved by the basic tests of autonomous edits', () => {
    const run = era(['autonomous-edits']);
    const rates = deriveRates(run, catalog);
    expect(rates.uncheckedFraction).toBe(0.5);
    expect(rates.debtPerUncheckedWork).toBeGreaterThan(0);
    const after = steps(run, 10, catalog);
    // One second of funded work: work × unchecked × rate, minus the tests' small review.
    const expected =
      rates.workPerAgentPerSecond * rates.uncheckedFraction * rates.debtPerUncheckedWork -
      rates.reviewPerSecond;
    expect(after.economy.debt).toBeCloseTo(expected, 6);
  });

  it('never accrues debt from free manual work', () => {
    let run = era(['autonomous-edits'], { tasks: 0, tokens: 0 });
    run = { ...run, unlockedTechnologyIds: run.unlockedTechnologyIds };
    for (let i = 0; i < 5; i += 1)
      run = steps(act(run, { type: 'primaryAction' }, catalog), 1, catalog);
    // PROMPT queues tasks but tokens are near zero; only the tiny funded part creates debt.
    expect(run.economy.debt).toBeLessThan(0.05);
  });

  it('reduces useful output by quality but keeps a positive floor', () => {
    expect(qualityEfficiency(0)).toBe(1);
    expect(qualityEfficiency(100)).toBeCloseTo(0.5, 9);
    expect(qualityEfficiency(1e6)).toBe(QUALITY_FLOOR);
  });

  it('lets review remove debt without generating tokens, never below zero', () => {
    const run = era(
      ['autonomous-edits', 'tool-permissions', 'persistent-instructions', 'ralph-loop', 'reviewer'],
      {
        debt: 10,
        tasks: 0,
        tokens: 0,
      },
    );
    const after = steps(run, 10, catalog);
    expect(after.economy.debt).toBeLessThan(10);
    expect(after.economy.tokens).toBeLessThanOrEqual(run.economy.tokens + 2.0001);
    const clean = steps({ ...run, economy: { ...run.economy, debt: 0.1 } }, 50, catalog);
    expect(clean.economy.debt).toBeGreaterThanOrEqual(0);
  });

  it('still reviews while generation is token-starved (recovery path)', () => {
    const run = era(
      ['autonomous-edits', 'tool-permissions', 'persistent-instructions', 'ralph-loop', 'reviewer'],
      {
        debt: 50,
        tokens: 0,
      },
    );
    expect(steps(run, 100, catalog).economy.debt).toBeLessThan(50);
  });
});
