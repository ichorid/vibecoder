import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { createRun } from './createRun';
import { deriveRates, economyFlows } from './economy';
import { creditState } from './money';
import { stepRun } from './simulation';
import type { RunState } from './types';

/** The finished company, after expanding into every market: costs far above revenue. */
function expanded(money = 0): RunState {
  const ids = catalog.technologies.map((t) => t.id);
  const run = createRun(2, 'money');
  return {
    ...run,
    unlockedTechnologyIds: ids,
    upgradeLevels: Object.fromEntries(ids.map((id) => [id, 1])),
    history: ids.map((id) => ({ kind: 'technology' as const, id, activeMs: 0 })),
    economy: { ...run.economy, money, tokens: 1e9, tasks: 60 },
    choices: { 'expand-anyway': { atActiveMs: 0, manualActions: 0, overhead: 5000 } },
  };
}

const steps = (start: RunState, count: number) => {
  let run = start;
  for (let i = 0; i < count && run.status === 'playing'; i += 1)
    run = stepRun(run, 100, catalog).run;
  return run;
};

describe('the credit line', () => {
  it('lets the bank go into the red and keeps the agents working on borrowed money', () => {
    const run = steps(expanded(0), 20);
    expect(run.economy.money).toBeLessThan(0);
    const rates = deriveRates(run, catalog);
    const flows = economyFlows(run.economy, rates, 0.1, catalog.balance);
    expect(flows.activeAgents).toBe(flows.runnable);
  });

  it('charges interest on what is owed', () => {
    const run = expanded(-10_000);
    const flows = economyFlows(run.economy, deriveRates(run, catalog), 1, catalog.balance);
    expect(flows.interest).toBeCloseTo(10_000 * catalog.balance.money.interestPerSecond, 9);
  });

  it('counts down to the limit, and the creditors close the company there', () => {
    const run = steps(expanded(0), 20);
    const credit = creditState(run, catalog);
    expect(credit?.secondsLeft).toBeGreaterThan(0);
    expect(credit?.limit).toBeCloseTo(
      run.economy.costPerSecond * catalog.balance.money.creditSeconds,
      6,
    );
    const broke = steps(run, 10 * 60 * 10);
    expect(broke.status).toBe('ended');
    expect(broke.ending?.id).toBe('fully-automated-bankruptcy');
    const lines = broke.log.map((l) => l.text).filter((t) => t.startsWith('🏦'));
    expect(lines).toHaveLength(3);
  });

  it('pulling out of every market removes the overhead', () => {
    const run = expanded(0);
    const out = {
      ...run,
      choices: {
        ...run.choices,
        'cancel-expansion': { atActiveMs: 0, manualActions: 0, overhead: 0 },
      },
    };
    expect(deriveRates(out, catalog).fixedOverheadPerSecond).toBe(0);
    expect(deriveRates(run, catalog).fixedOverheadPerSecond).toBe(5000);
  });
});
