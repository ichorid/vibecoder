import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { withTechnologies } from '../../tests/helpers/unlock';
import { applyCommand } from './commands';
import { createRun } from './createRun';
import { codePrice, deriveRates, economyFlows, upgradePrice } from './economy';
import type { TechnologyId, UpgradeId } from './ids';
import type { RunState } from './types';

/** Through Local servers: several agents, real efficiency multipliers, an agent worth a lot. */
const TO_LOCAL_SERVERS: TechnologyId[] = catalog.technologies
  .map((t) => t.id)
  .slice(0, catalog.technologies.findIndex((t) => t.id === 'local-servers') + 1);

function era(ids: readonly TechnologyId[], levels: Partial<Record<UpgradeId, number>> = {}) {
  const run = withTechnologies(createRun(4, 'r'), ids, catalog);
  return {
    ...run,
    upgradeLevels: { ...run.upgradeLevels, ...levels },
    economy: { ...run.economy, tokens: 1e6, tasks: 1e4, money: 1e9 },
  };
}

const card = (id: UpgradeId) => {
  const definition = catalog.upgrades.find((u) => u.id === id);
  if (!definition) throw new Error(`missing ${id}`);
  return definition;
};

/** One runnable agent's useful code per second right now. */
function perAgent(run: RunState): number {
  const flows = economyFlows(run.economy, deriveRates(run, catalog), 0.1, catalog.balance);
  return flows.useful / 0.1 / Math.max(1, flows.runnable);
}

const CAPACITY = ['additional-agent', 'compute-slot', 'review-capacity'] as const;

describe('capacity cards (agents, compute, reviewers)', () => {
  it('are worth about K seconds of one agent’s work, never less than the base price', () => {
    const late = era(TO_LOCAL_SERVERS, { 'compute-slot': 4 });
    for (const id of CAPACITY) {
      const definition = card(id);
      const seconds = definition.priceRule?.paybackSeconds ?? 0;
      expect(seconds).toBeGreaterThan(0);
      const expected = seconds * perAgent(late);
      expect(expected).toBeGreaterThan(definition.basePrice);
      const price = codePrice(late, definition, catalog);
      expect(price).toBeGreaterThan(expected * 0.9);
      expect(price).toBeLessThan(expected * 1.1);
    }
  });

  it('while agents earn nothing, cost the level price: a gentle rise, no doubling', () => {
    const early = createRun(4, 'r');
    for (const id of CAPACITY) {
      const definition = card(id);
      expect(codePrice(early, definition, catalog)).toBe(definition.basePrice);
      expect(definition.priceGrowth).toBeGreaterThan(1);
      expect(definition.priceGrowth).toBeLessThanOrEqual(1.25);
      const owned = { ...early, upgradeLevels: { ...early.upgradeLevels, [id]: 12 } };
      const floor = upgradePrice(definition, 12);
      expect(codePrice(owned, definition, catalog)).toBeGreaterThan(floor * 0.95);
      expect(codePrice(owned, definition, catalog)).toBeLessThan(floor * 1.05);
    }
  });

  it('compute (bought with money) can be bought well past eight levels', () => {
    let run = era(TO_LOCAL_SERVERS);
    for (let i = 0; i < 20; i += 1) {
      const bought = applyCommand(
        run,
        { type: 'buyUpgrade', id: 'compute-slot' },
        run.activeMs,
        catalog,
      );
      expect(bought.result).toBe('applied');
      run = bought.run;
    }
    expect(run.upgradeLevels['compute-slot']).toBe(20);
  });

  it('a senior reviewer also coordinates one more agent', () => {
    const run = era(TO_LOCAL_SERVERS);
    const hired = { ...run, upgradeLevels: { ...run.upgradeLevels, 'review-capacity': 2 } };
    expect(deriveRates(hired, catalog).managed).toBe(deriveRates(run, catalog).managed + 2);
  });
});
