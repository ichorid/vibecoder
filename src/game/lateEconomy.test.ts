import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { act, steps } from '../../tests/helpers/run';
import { withTechnologies } from '../../tests/helpers/unlock';
import { createRun } from './createRun';
import { automationFraction, creditLimit, deriveRates } from './economy';
import { TECHNOLOGY_IDS, type TechnologyId } from './ids';
import { selectGame } from './selectors';
import type { RunState } from './types';

function through(id: TechnologyId, patch: Partial<RunState['economy']> = {}): RunState {
  const ids = TECHNOLOGY_IDS.slice(0, TECHNOLOGY_IDS.indexOf(id) + 1);
  const run = withTechnologies(createRun(21, 'late'), ids, catalog);
  return { ...run, economy: { ...run.economy, tokens: 5000, tasks: 60, ...patch } };
}

describe('infrastructure (13–17)', () => {
  it('model routing lowers token cost but keeps it positive', () => {
    const before = deriveRates(through('persistent-memory'), catalog).tokenCostPerWork;
    const after = deriveRates(through('model-routing'), catalog).tokenCostPerWork;
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThanOrEqual(catalog.balance.minTokenCostPerWork);
  });

  it('token optimization raises supply and spending never becomes negative', () => {
    const run = steps(through('token-optimization', { tokens: 0 }), 30, catalog);
    expect(deriveRates(run, catalog).tokenSupplyPerSecond).toBeGreaterThan(
      deriveRates(through('model-routing'), catalog).tokenSupplyPerSecond,
    );
    expect(run.economy.tokens).toBeGreaterThanOrEqual(0);
  });

  it('local servers add compute without fixing coordination or review', () => {
    const before = deriveRates(through('token-optimization'), catalog);
    const after = deriveRates(through('local-servers'), catalog);
    expect(after.compute).toBeGreaterThan(before.compute);
    expect(after.managed).toBe(before.managed);
    expect(after.reviewPerSecond).toBe(before.reviewPerSecond);
  });

  it('the panel fills up as the company grows: one row of four at most early, six from finance', () => {
    for (const id of TECHNOLOGY_IDS) {
      const count = selectGame(through(id), catalog).stats.length;
      expect(count).toBeLessThanOrEqual(6);
      if (TECHNOLOGY_IDS.indexOf(id) < TECHNOLOGY_IDS.indexOf('evaluations')) {
        expect(count).toBeLessThanOrEqual(4);
      }
    }
    const finance = selectGame(through('finance'), catalog).stats.map((s) => s.id);
    expect(finance.slice(0, 5)).toEqual(['code', 'tokens', 'debt', 'money', 'margin']);
    // The progress meter's slot, unless QUALITY or TEAM hurts right now (E2).
    expect(['automation', 'quality', 'team']).toContain(finance[5]);
  });
});

describe('recursive automation (18–22)', () => {
  it('derives harness rates once from definitions (recomputing never stacks)', () => {
    const run = through('custom-harness');
    const a = deriveRates(run, catalog);
    const b = deriveRates(steps(run, 50, catalog), catalog);
    expect(b.managed).toBe(a.managed);
    expect(b.workPerAgentPerSecond).toBe(a.workPerAgentPerSecond);
  });

  it('evaluations automate supervising: the action becomes OPTIMIZE later, review grows', () => {
    const before = deriveRates(through('meta-harness'), catalog);
    const after = deriveRates(through('evaluations'), catalog);
    expect(after.reviewPerSecond).toBeGreaterThan(before.reviewPerSecond);
    expect(automationFraction(through('evaluations'), catalog)).toBeGreaterThan(
      automationFraction(through('meta-harness'), catalog),
    );
  });

  it('OPTIMIZE gives a bounded temporary efficiency boost that decays', () => {
    let run = through('workflow-optimization');
    expect(selectGame(run, catalog).primaryAction.label).toBe('OPTIMIZE');
    for (let i = 0; i < 20; i += 1) run = act(run, { type: 'primaryAction' }, catalog);
    expect(run.economy.optimization).toBe(catalog.balance.optimizeCap);
    run = steps(run, 600, catalog);
    expect(run.economy.optimization).toBe(0);
  });

  it('self-improvement is a bounded passive rate, not recursion within a tick', () => {
    const run = through('self-improvement');
    const rates = deriveRates(run, catalog);
    expect(Number.isFinite(rates.efficiency)).toBe(true);
    expect(rates.efficiency).toBeLessThan(5);
    const later = steps(run, 100, catalog);
    expect(deriveRates(later, catalog).efficiency).toBe(rates.efficiency);
  });
});

describe('organizations (23–28)', () => {
  it('earns no revenue until product management, then earns it from useful output', () => {
    const before = steps(through('self-driving-repositories'), 50, catalog);
    expect(before.economy.revenuePerSecond).toBe(0);
    const after = steps(through('product-management'), 50, catalog);
    expect(after.economy.revenuePerSecond).toBeGreaterThan(0);
    expect(after.economy.money).toBeGreaterThan(0);
    expect(selectGame(after, catalog).stats.map((s) => s.id)).toContain('money');
  });

  it('shows MONEY on the panel in a real run too (the first gig has long fired)', () => {
    const run = through('finance', { money: 1000 });
    const gigged = {
      ...run,
      narrative: { ...run.narrative, fired: [...run.narrative.fired, 'first-gig'] },
    };
    const ids = selectGame(gigged, catalog).stats.map((s) => s.id);
    expect(ids.slice(0, 5)).toEqual(['code', 'tokens', 'debt', 'money', 'margin']);
  });

  it('subtracts operating costs after finance and tracks the margin', () => {
    const run = steps(through('finance', { money: 1000 }), 50, catalog);
    expect(run.economy.costPerSecond).toBeGreaterThan(0);
    expect(selectGame(run, catalog).stats.map((s) => s.id)).toContain('margin');
  });

  it('idles unfunded capacity when revenue runs out, never past the credit line', () => {
    const run = through('finance', { money: 0 });
    const starved = { ...run, upgradeLevels: { ...run.upgradeLevels, 'additional-agent': 8 } };
    const later = steps(starved, 200, catalog);
    const limit = creditLimit(later.economy.costPerSecond, catalog.balance);
    expect(later.economy.money).toBeGreaterThanOrEqual(-limit - 1e-6);
    expect(Number.isFinite(later.stats.lifetimeOutput)).toBe(true);
  });

  it('OBSERVE produces no manual output and the cat keeps its own state', () => {
    let run = through('autonomous-company', { tasks: 0, tokens: 0 });
    run = { ...run, cat: { ...run.cat, alive: false, health: 0, diedAtActiveMs: 5 } };
    expect(selectGame(run, catalog).primaryAction.label).toBe('OBSERVE');
    const pressed = act(run, { type: 'primaryAction' }, catalog);
    expect(pressed.economy.pendingManualWork).toBe(0);
    expect(steps(pressed, 10, catalog).cat.alive).toBe(false);
    expect(automationFraction(run, catalog)).toBe(1);
  });
});
