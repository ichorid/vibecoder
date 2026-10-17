import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { steps } from '../../tests/helpers/run';
import { applyCommand } from './commands';
import { createRun } from './createRun';
import { deriveRates, marketRate, offerPrice, tokenDemandPerSecond, tokenPack } from './economy';
import { selectGame } from './selectors';
import type { TechnologyId } from './ids';
import type { RunState } from './types';

const tokens = catalog.balance.tokens;
const ids = catalog.technologies.map((t) => t.id);
const upTo = (last: TechnologyId) => ids.slice(0, ids.indexOf(last) + 1);

function at(last: TechnologyId, patch: Partial<RunState['economy']> = {}, seed = 4): RunState {
  const run = createRun(seed, 'tok');
  return {
    ...run,
    unlockedTechnologyIds: upTo(last),
    // Each technology's progression card was bought (their IDs match).
    upgradeLevels: Object.fromEntries(upTo(last).map((id) => [id, 1])),
    economy: { ...run.economy, money: 100_000, tasks: 60, ...patch },
    // Money is already on screen (no first-gig savings land during these steps).
    narrative: { ...run.narrative, fired: ['first-gig'] },
  };
}
/** Money cards are bought; code cards are owned directly (unit-test shortcut for a build). */
const buy = (run: RunState, id: string) => {
  const upgrade = catalog.upgrades.find((u) => u.id === id);
  if (upgrade?.currency === 'money') {
    return applyCommand(run, { type: 'buyUpgrade', id: id as never }, run.activeMs, catalog);
  }
  return {
    result: 'applied' as const,
    run: { ...run, upgradeLevels: { ...run.upgradeLevels, [id]: 1 } },
  };
};
const packPrice = (run: RunState) => {
  const pack = catalog.upgrades.find((u) => u.pack === 'tokens');
  if (!pack) throw new Error('no pack');
  return offerPrice(run, pack, catalog);
};
const offered = (run: RunState, id: string) =>
  selectGame(run, catalog).offers.some((o) => o.id === id);

describe('buying tokens with money', () => {
  it('a pack is about a minute of current agent demand (at least the minimum) at the base rate', () => {
    const early = at('terminal-agent');
    const pack = tokenPack(early, catalog);
    const rates = deriveRates(early, catalog);
    const demand =
      Math.min(rates.agents, rates.compute) * rates.workPerAgentPerSecond * rates.tokenCostPerWork;
    expect(pack.tokens).toBe(Math.max(tokens.packMin, demand * tokens.packSeconds));
    expect(pack.price).toBe(Math.ceil(pack.tokens / tokens.perCodeBase));
    const mid = tokenPack(at('manager-agent'), catalog);
    expect(mid.tokens).toBeGreaterThan(pack.tokens);
  });

  it('a pack costs its code value at the market rate, rounded up by the reseller', () => {
    const run = at('terminal-agent');
    const pack = tokenPack(run, catalog);
    const raw = pack.price * marketRate(run, catalog) * catalog.balance.gigs.tokenMarkup;
    expect(packPrice(run)).toBeGreaterThanOrEqual(raw * 0.95);
    expect(packPrice(run)).toBeLessThanOrEqual(raw * 1.05);
  });

  it('buying a pack spends money and adds the tokens; the card shows only while tokens run low', () => {
    const run = at('terminal-agent', { tokens: 5 });
    const pack = tokenPack(run, catalog);
    const price = packPrice(run);
    const bought = buy(run, 'token-supply');
    expect(bought.result).toBe('applied');
    expect(bought.run.economy.money).toBe(100_000 - price);
    expect(bought.run.economy.tokens).toBe(5 + pack.tokens);
    // Plenty of tokens now: the card makes room until they would last under half a minute.
    const demand = tokenDemandPerSecond(deriveRates(run, catalog));
    const full = {
      ...bought.run,
      economy: { ...bought.run.economy, tokenDemandPerSecond: demand },
    };
    expect(offered(full, 'token-supply')).toBe(false);
    const low = { ...full, economy: { ...full.economy, tokens: demand * 29 } };
    expect(offered(low, 'token-supply')).toBe(true);
    const card = selectGame(run, catalog).offers.find((o) => o.id === 'token-supply');
    expect(card).toMatchObject({ price, tokens: pack.tokens, currency: 'money' });
    // Without the money, the pack cannot be bought.
    const broke = buy({ ...run, economy: { ...run.economy, money: price - 1 } }, 'token-supply');
    expect(broke.result).toBe('unaffordable');
  });
});

describe('auto-refill', () => {
  /** A run that burns tokens: many agents, no subscription left to cover them. */
  function hungry(version: 1 | 2, seed = 4): RunState {
    let run = at('ralph-loop', { tokens: 0 }, seed);
    run = buy(run, 'auto-refill-v1').run;
    if (version === 2) {
      run = { ...run, stats: { ...run.stats, refillDisasters: 1 } };
      run = buy(run, 'auto-refill-v2').run;
    }
    return run;
  }

  it('v1 buys a pack when tokens run low, while money lasts', () => {
    const run = hungry(1);
    const next = steps(run, 1, catalog);
    expect(next.economy.autoRefills).toBe(1);
    expect(next.economy.tokens).toBeGreaterThan(0);
    expect(next.economy.money).toBeLessThan(run.economy.money);
    // No money, no pack: the agents stall.
    const broke = steps({ ...run, economy: { ...run.economy, money: 0 } }, 1, catalog);
    expect(broke.economy.autoRefills).toBe(0);
  });

  it('waits until the tokens are really gone: no refill while any are left', () => {
    for (const version of [1, 2] as const) {
      const run = hungry(version);
      // Enough for a few seconds of this hungry run — far below the old "20 s left" trigger.
      const demand = tokenDemandPerSecond(deriveRates(run, catalog));
      const low = { ...run, economy: { ...run.economy, tokens: Math.max(10, demand * 3) } };
      expect(steps(low, 1, catalog).economy.autoRefills).toBe(0);
      const empty = { ...run, economy: { ...run.economy, tokens: 0 } };
      expect(steps(empty, 1, catalog).economy.tokens).toBeGreaterThan(1);
    }
  });

  it('with auto-refill v1 the manual pack is hidden, and comes back after its first bug', () => {
    const low = (run: RunState) => ({ ...run, economy: { ...run.economy, tokens: 0 } });
    expect(offered(low(at('ralph-loop')), 'token-supply')).toBe(true);
    const trusting = hungry(1);
    expect(offered(low(trusting), 'token-supply')).toBe(false);
    const burned = { ...trusting, stats: { ...trusting.stats, refillDisasters: 1 } };
    expect(offered(low(burned), 'token-supply')).toBe(true);
  });

  it('the bug costs at least 30 s of what the code earns, or all the money (savers and spenders)', () => {
    for (const bank of [600, 5_000, 1e6]) {
      let run = hungry(1, 1);
      run = { ...run, economy: { ...run.economy, money: bank, codeRate: 40 } };
      for (let refill = 1; refill <= 6 && run.stats.refillDisasters === 0; refill += 1) {
        run = { ...run, economy: { ...run.economy, tokens: 0, money: bank } };
        const perSecond = run.economy.codeRate * marketRate(run, catalog);
        const next = steps(run, 1, catalog);
        if (next.stats.refillDisasters === 1) {
          const lost = bank - next.economy.money;
          const floor = Math.min(
            bank,
            Math.max(bank * tokens.disasterLoss, tokens.disasterSeconds * perSecond),
          );
          expect(lost).toBeGreaterThan(floor * 0.9);
          expect(next.economy.money).toBeGreaterThanOrEqual(0);
        }
        run = next;
      }
      expect(run.stats.refillDisasters).toBe(1);
    }
  });

  it('v1 has a bug: one of its refills 3–6 spends half the money and delivers no tokens', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let run = hungry(1, seed);
      let disasterAt = 0;
      for (let refill = 1; refill <= 6 && disasterAt === 0; refill += 1) {
        run = { ...run, economy: { ...run.economy, tokens: 0 } };
        const before = run.economy.money;
        const next = steps(run, 1, catalog);
        if (next.stats.refillDisasters === 1) {
          disasterAt = next.economy.autoRefills;
          // Half the money is gone.
          expect(next.economy.money).toBeLessThan(before * (1 - tokens.disasterLoss) + 1);
          expect(next.economy.money).toBeGreaterThan(before * (1 - tokens.disasterLoss) - 1);
          expect(next.economy.tokens).toBeLessThan(1);
          expect(next.log.some((line) => /wrong account|charity/.test(line.text))).toBe(true);
        }
        run = next;
      }
      expect(disasterAt).toBeGreaterThanOrEqual(tokens.firstDisasterFrom);
      expect(disasterAt).toBeLessThanOrEqual(tokens.firstDisasterTo);
    }
  });

  it('v2 appears only after the first disaster, replaces v1 and never deletes money', () => {
    const before = hungry(1);
    expect(offered(before, 'auto-refill-v2')).toBe(false);
    let run = hungry(2);
    expect(offered(run, 'auto-refill-v1')).toBe(false);
    for (let i = 0; i < 40; i += 1) {
      run = steps({ ...run, economy: { ...run.economy, tokens: 0 } }, 1, catalog);
    }
    expect(run.stats.refillDisasters).toBe(1);
    expect(run.economy.money).toBeGreaterThan(50_000);
  });

  it('auto-reviewer raises the rate every interval up to its cap', () => {
    let run = buy(at('evaluations'), 'auto-reviewer').run;
    run = steps(run, tokens.autoReviewEveryMs / 100, catalog);
    expect(run.economy.tokenReviewBonus).toBeCloseTo(tokens.autoReviewStep, 9);
    run = steps(run, (tokens.autoReviewEveryMs / 100) * 100, catalog);
    expect(run.economy.tokenReviewBonus).toBeCloseTo(tokens.autoReviewCap, 9);
  });
});
