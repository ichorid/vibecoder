import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { createRun } from './createRun';
import { momentTier, selectTokenGauge } from './deck';
import { deriveRates, offerPrice, tokenDemandPerSecond, tokenPack } from './economy';
import type { TechnologyId } from './ids';
import { isProjectAvailable } from './projects';
import { selectGame } from './selectors';
import type { RunState } from './types';

const ids = catalog.technologies.map((t) => t.id);
const upTo = (last: TechnologyId) => ids.slice(0, ids.indexOf(last) + 1);

function at(last: TechnologyId, patch: Partial<RunState['economy']> = {}): RunState {
  const run = createRun(4, 'deck');
  return {
    ...run,
    unlockedTechnologyIds: upTo(last),
    upgradeLevels: Object.fromEntries(upTo(last).map((id) => [id, 1])),
    economy: { ...run.economy, money: 100_000, tasks: 60, ...patch },
    narrative: { ...run.narrative, fired: ['first-gig'] },
  };
}

const deck = (run: RunState) => selectGame(run, catalog).deck;
const keys = (run: RunState) => deck(run).lane.map((i) => i.key);

describe('the build deck: rows and lane', () => {
  it('a build row per slot, in slot order; what a slot builds stays in the lane, in place', () => {
    const run = { ...at('autocomplete'), slots: createRun(1, 'rows').slots };
    const view = deck(run);
    expect(view.builds.map((b) => [b.slot, b.item.key])).toEqual([[0, 'release']]);
    expect(view.builds[0]?.item.project?.badge).not.toBeNull();
    expect(keys(run)).toContain('release');
    const card = deck(run).lane.find((i) => i.kind === 'upgrade');
    if (!card) throw new Error('no card on offer');
    const picked: RunState = {
      ...run,
      slots: [{ target: card.key as never, by: 'player', sinceMs: 0 }],
    };
    expect(deck(picked).builds[0]?.item).toMatchObject({ key: card.key, kind: 'upgrade' });
    // A pick moves the highlight, not the items: the lane is the same list in the same order.
    expect(keys(picked)).toEqual(keys(run));
  });

  it('keeps a build in the lane even when its card is past the three-card limit', () => {
    const run = at('reviewer');
    const shown = new Set(keys(run));
    const hidden = catalog.upgrades.find(
      (u) =>
        u.currency === 'output' &&
        !u.internal &&
        !u.discovers &&
        !u.priceRule &&
        !shown.has(u.id) &&
        isProjectAvailable(run, u.id, catalog),
    );
    if (!hidden) throw new Error('every offered card is already shown');
    const picked: RunState = {
      ...run,
      slots: [{ target: hidden.id, by: 'system', sinceMs: 0 }],
    };
    expect(deck(picked).builds[0]?.item.key).toBe(hidden.id);
    expect(keys(picked)).toContain(hidden.id);
  });

  it('holds the release, the demo, the gig or the search, the job offer, cards and decisions', () => {
    const run = at('ralph-loop');
    const items = deck(run).lane;
    const kinds = new Set(items.map((i) => i.kind));
    expect(kinds.has('demo')).toBe(true);
    for (const item of items) expect(item.title.length).toBeGreaterThan(0);
    const searching: RunState = {
      ...run,
      gigs: { offer: null, search: { done: 0, needed: 3 }, paid: 1, botMs: 0 },
    };
    expect(keys(searching)).toContain('search');
    expect(keys(searching)).not.toContain('gig');
    const offered: RunState = {
      ...run,
      job: { ...run.job, offer: { salary: 900, expiresAtMs: run.activeMs + 60_000 } },
    };
    expect(keys(offered)).toContain('job');
  });

  it('never holds the token pack (the gauge reloads), but does hold the compute slot', () => {
    const low = at('parallel-agents', { tokens: 0 });
    expect(selectGame(low, catalog).offers.some((o) => o.id === 'token-supply')).toBe(true);
    expect(keys(low)).not.toContain('token-supply');
    const compute = deck(low).lane.find((i) => i.key === 'compute-slot');
    if (compute) expect(compute.kind).toBe('upgrade');
  });

  it('keeps a paused build in the lane even past the three-card limit', () => {
    const run = at('reviewer');
    const cards = deck(run)
      .lane.filter((i) => i.kind === 'upgrade')
      .map((i) => i.key);
    const hidden = catalog.upgrades.find(
      (u) =>
        u.currency === 'output' &&
        !u.internal &&
        !u.discovers &&
        !u.priceRule &&
        !cards.includes(u.id) &&
        isProjectAvailable(run, u.id, catalog),
    );
    if (!hidden) throw new Error('every offered card is already shown');
    const paused: RunState = {
      ...run,
      projects: { ...run.projects, [hidden.id]: { code: 5, price: 1000 } },
    };
    expect(keys(paused)).toContain(hidden.id);
  });

  it('decisions are lane items with their own key', () => {
    const run = at('ralph-loop');
    const choice = selectGame(run, catalog).offers.find((o) => o.kind === 'choice');
    if (!choice) return;
    expect(keys(run)).toContain(`choice:${choice.id}`);
  });

  it('knows when Manager Agent picks the next build (completions do not ask then)', () => {
    expect(deck(at('ralph-loop')).managed).toBe(false);
    expect(deck(at('manager-agent')).managed).toBe(true);
  });
});

describe('the token gauge', () => {
  it('is absent before tokens cost money', () => {
    expect(selectTokenGauge(at('generated-snippets'), catalog)).toBeNull();
    expect(selectTokenGauge(at('terminal-agent'), catalog)).not.toBeNull();
  });

  it('shows time to empty, the pack price and the money after a reload', () => {
    const run = at('ralph-loop', { tokens: 3000 });
    const gauge = selectTokenGauge(run, catalog);
    if (!gauge) throw new Error('no gauge');
    const rates = deriveRates(run, catalog);
    const burn = tokenDemandPerSecond(rates) - rates.tokenSupplyPerSecond;
    expect(burn).toBeGreaterThan(0);
    expect(gauge.secondsLeft).toBeCloseTo(3000 / burn, 3);
    const pack = catalog.upgrades.find((u) => u.pack === 'tokens');
    if (!pack) throw new Error('no pack');
    expect(gauge.price).toBe(offerPrice(run, pack, catalog));
    expect(gauge.packTokens).toBe(tokenPack(run, catalog).tokens);
    expect(gauge.moneyAfter).toBe(100_000 - gauge.price);
    expect(gauge.affordable).toBe(true);
    expect(gauge.fraction).toBeGreaterThan(0);
    expect(gauge.fraction).toBeLessThanOrEqual(1);
  });

  it('states: full, low under 30 s, empty, and no money for a reload', () => {
    const base = at('ralph-loop');
    const rates = deriveRates(base, catalog);
    const burn = tokenDemandPerSecond(rates) - rates.tokenSupplyPerSecond;
    const withTokens = (tokens: number, money = 100_000) =>
      selectTokenGauge({ ...base, economy: { ...base.economy, tokens, money } }, catalog)?.state;
    expect(withTokens(burn * 90)).toBe('full');
    expect(withTokens(burn * 20)).toBe('low');
    expect(withTokens(0)).toBe('empty');
    expect(withTokens(0, 1)).toBe('noMoney');
  });

  it('warns when a reload would leave less than the rent due within two minutes', () => {
    const base = at('ralph-loop', { tokens: 0 });
    const pack = catalog.upgrades.find((u) => u.pack === 'tokens');
    if (!pack) throw new Error('no pack');
    const price = offerPrice(base, pack, catalog);
    const renting: RunState = {
      ...base,
      rent: { ...base.rent, movedOut: true, month: 1, nextDueMs: base.activeMs + 60_000 },
      economy: { ...base.economy, money: price + 10 },
    };
    const risk = selectTokenGauge(renting, catalog)?.rentRisk;
    expect(risk?.dueInSeconds).toBeCloseTo(60, 3);
    expect(risk?.rent).toBeGreaterThan(10);
    const later = { ...renting, rent: { ...renting.rent, nextDueMs: base.activeMs + 300_000 } };
    expect(selectTokenGauge(later, catalog)?.rentRisk).toBeNull();
  });

  it('names the auto-refill version', () => {
    const base = at('ralph-loop');
    expect(selectTokenGauge(base, catalog)?.auto).toBeNull();
    const v1 = { ...base, upgradeLevels: { ...base.upgradeLevels, 'auto-refill-v1': 1 } };
    expect(selectTokenGauge(v1, catalog)?.auto).toBe(1);
    const v2 = { ...v1, upgradeLevels: { ...v1.upgradeLevels, 'auto-refill-v2': 1 } };
    expect(selectTokenGauge(v2, catalog)?.auto).toBe(2);
  });
});

describe('moments: how big a ta-da is', () => {
  it('S for a discovery or a ready release/demo, A for an upgrade level, B for a gig', () => {
    expect(momentTier({ type: 'projectBuilt', id: 'autocomplete' }, catalog)).toBe('S');
    expect(momentTier({ type: 'projectReady', id: 'release' }, catalog)).toBe('S');
    expect(momentTier({ type: 'projectReady', id: 'demo' }, catalog)).toBe('S');
    const level = catalog.upgrades.find(
      (u) => u.currency === 'output' && !u.discovers && !u.internal,
    );
    if (!level) throw new Error('no plain upgrade');
    expect(momentTier({ type: 'projectBuilt', id: level.id }, catalog)).toBe('A');
    expect(momentTier({ type: 'projectBuilt', id: 'gig' }, catalog)).toBe('B');
    expect(momentTier({ type: 'catDied' }, catalog)).toBeNull();
  });
});
