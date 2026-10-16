import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { applyCommand } from './commands';
import type { Catalog } from './catalog';
import { createRun } from './createRun';
import { TECHNOLOGY_IDS, type TechnologyId } from './ids';
import { jackpotHazard, nextRelease, releaseAt } from './releases';
import { selectGame, selectRelease } from './selectors';
import { stepRun } from './simulation';
import type { RunState } from './types';

const windows = catalog.releases.windows;

/** A run that has unlocked `ids` (in order) at `at`, with plenty of code to spend. */
function withTechnologies(ids: readonly TechnologyId[], at = 0, output = 1e9): RunState {
  const run = createRun(7, 'release-test');
  return {
    ...run,
    activeMs: at,
    unlockedTechnologyIds: [...ids],
    // Owning a technology means its progression upgrade was bought (same IDs).
    upgradeLevels: Object.fromEntries(ids.map((id) => [id, 1])),
    history: ids.map((id) => ({ kind: 'technology' as const, id, activeMs: at })),
    economy: { ...run.economy, output },
    stats: { ...run.stats, lifetimeOutput: output },
  };
}

const ship = (run: RunState, cat: Catalog = catalog) =>
  applyCommand(run, { type: 'shipRelease' }, run.activeMs, cat);

/** The real catalog with other jackpot weights (0 = never, 100 at window 1 = always). */
function withWeights(weights: readonly number[], overrides: Partial<Catalog['releases']> = {}) {
  return {
    ...catalog,
    releases: {
      ...catalog.releases,
      ...overrides,
      windows: windows.map((w, i) => ({ ...w, jackpotWeight: weights[i] ?? 0 })),
    },
  } satisfies Catalog;
}

describe('jackpot odds', () => {
  it('weights sum to 20 and the shown hazard makes each window worth exactly its weight', () => {
    expect(windows.reduce((sum, w) => sum + w.jackpotWeight, 0)).toBe(20);
    const hazards = windows.map((_, i) => jackpotHazard(catalog.releases, i + 1));
    const expected = [0.002, 0.00802, 0.0202, 0.05155, 0.13043];
    hazards.forEach((h, i) => expect(h).toBeCloseTo(expected[i] ?? 0, 4));
    expect(hazards.reduce((p, h) => p * (1 - h), 1)).toBeCloseTo(0.8, 10);
    // Releases after v3.0 keep its chance.
    expect(jackpotHazard(catalog.releases, 9)).toBeCloseTo(expected[4] ?? 0, 4);
  });
});

describe('the next release', () => {
  it('is always on offer once the project works, never before and never after the end', () => {
    expect(nextRelease(withTechnologies(['autocomplete']), catalog)).toBeNull();
    const run = withTechnologies(['autocomplete', 'terminal-agent']);
    expect(nextRelease(run, catalog)?.version).toBe('v0.1');
    expect(nextRelease({ ...run, status: 'ended' }, catalog)).toBeNull();
    // No time limit: an hour later it is still there.
    expect(nextRelease({ ...run, activeMs: 3_600_000 }, catalog)?.version).toBe('v0.1');
  });

  it('after the authored releases, the next ones keep coming, each ×6 dearer', () => {
    const last = windows[windows.length - 1];
    expect(releaseAt(catalog.releases, 6)).toMatchObject({
      window: 6,
      version: 'v4.0',
      price: (last?.price ?? 0) * 6,
    });
    expect(releaseAt(catalog.releases, 7).version).toBe('v5.0');
  });

  it('logs a line once when a release becomes available', () => {
    let run = withTechnologies(['terminal-agent'], 0, 0);
    run = stepRun(run, 100, catalog).run;
    run = stepRun(run, 100, catalog).run;
    const lines = run.log.map((l) => l.text).filter((t) => t.startsWith('🚢'));
    expect(lines).toEqual([`🚢 ${windows[0]?.description}`]);
  });
});

describe('shipping a release', () => {
  it('is rejected before the project works, below the minimum, or after the end', () => {
    expect(ship(withTechnologies(['autocomplete'])).result).toBe('unavailable');
    const run = withTechnologies(['terminal-agent'], 0, 1999);
    expect(ship(run).result).toBe('unaffordable');
    const rich = withTechnologies(['terminal-agent']);
    const shipped = ship(rich, withWeights([0])).run;
    // The next release is on offer at once; it just needs code again.
    expect(nextRelease(shipped, catalog)?.version).toBe('v0.2');
    expect(ship(shipped).result).toBe('unaffordable');
    expect(ship({ ...rich, status: 'ended' }).result).toBe('unavailable');
  });

  it('spends ALL the code (not just the minimum) and leaves lifetime output alone', () => {
    const run = withTechnologies(['terminal-agent'], 0, 5000);
    const shipped = ship(run, withWeights([0]));
    expect(shipped.result).toBe('applied');
    expect(shipped.run.economy.output).toBe(0);
    expect(shipped.run.stats.lifetimeOutput).toBe(run.stats.lifetimeOutput);
    expect(shipped.run.releases).toHaveLength(1);
    expect(shipped.facts[0]).toMatchObject({ type: 'releaseShipped', window: 1 });
    expect(shipped.run.history.at(-1)).toMatchObject({ kind: 'release', window: 1 });
    expect(shipped.run.log.at(-1)?.text).toMatch(/^📦 Shipped v0\.1: /);
  });

  it('depends on the seed and the number of releases, not on when it is shipped', () => {
    const run = withTechnologies(['terminal-agent']);
    const now = ship(run).run.releases[0];
    const waited = steps(run, 500);
    const afterWaiting = ship(waited).run.releases[0];
    expect(afterWaiting?.outcome).toBe(now?.outcome);
    expect(afterWaiting?.commentId).toBe(now?.commentId);
  });

  it('never repeats a slice or a comment within a run', () => {
    const noJackpot = withWeights([0, 0, 0, 0, 0]);
    let run = withTechnologies(['terminal-agent']);
    for (let i = 0; i < 5; i += 1) {
      run = ship({ ...run, economy: { ...run.economy, output: 1e9 } }, noJackpot).run;
    }
    expect(run.releases.map((r) => r.window)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(run.releases.map((r) => r.outcome)).size).toBe(5);
    expect(new Set(run.releases.map((r) => r.commentId)).size).toBe(5);
    expect(run.achievementIds).toEqual([]);
    const stepped = stepRun(run, 100, noJackpot).run;
    expect(stepped.achievementIds).toEqual(
      expect.arrayContaining(['first-release', 'serial-shipper']),
    );
  });

  it('a jackpot ends the run with The Infinite Weekend in the same transition', () => {
    const run = withTechnologies(['terminal-agent'], 1000);
    const won = ship(run, withWeights([100]));
    expect(won.run.status).toBe('ended');
    expect(won.run.ending).toEqual({
      id: 'the-infinite-weekend',
      catAlive: true,
      catLeft: false,
      activeMs: 1000,
    });
    expect(won.run.releases[0]).toMatchObject({ outcome: 'jackpot', commentId: null });
    expect(won.facts.map((f) => f.type)).toEqual(['releaseShipped', 'endingReached']);
  });

  it('the cat-aware slice reads the cat as it was when the release shipped', () => {
    const only = withWeights([0], {
      slices: catalog.releases.slices.filter((s) => s.id === 'cat-review'),
    });
    const alive = ship(withTechnologies(['terminal-agent']), only).run;
    expect(selectRelease(alive, only, 0)?.result.label).toBe('CAT REVIEW');
    const run = withTechnologies(['terminal-agent']);
    const gone = { ...run, cat: { ...run.cat, alive: false, health: 0, diedAtActiveMs: 0 } };
    const shipped = ship(gone, only).run;
    expect(selectRelease(shipped, only, 0)?.result.label).toBe('NO REVIEW');
    expect(selectRelease(shipped, only, 0)?.result.text).not.toMatch(/cat/i);
  });

  it('the release has its own strip, outside the three cards, with price and shortfall', () => {
    const run = withTechnologies(
      ['autocomplete', 'generated-snippets', 'ai-native-ide', 'terminal-agent'],
      0,
      100,
    );
    const game = selectGame(run, catalog);
    expect(game.offers.some((o) => (o.kind as string) === 'release')).toBe(false);
    expect(game.release).toMatchObject({
      title: 'Ship v0.1',
      price: 2000,
      affordable: false,
      shortfall: 1900,
    });
    expect(game.release?.retireChance).toBeCloseTo(0.002, 9);
  });
});

describe('archiving the original project', () => {
  it('remembers how many times it was shipped', () => {
    const text = catalog.choices.find((c) => c.id === 'archive-original')?.description;
    const describe = (run: RunState) => (typeof text === 'function' ? text(run) : text);
    const run = withTechnologies(['terminal-agent']);
    expect(describe(run)).toMatch(/still unshipped/);
    const once = ship(run, withWeights([0])).run;
    expect(describe(once)).toBe('You shipped it once. Nobody noticed. The harness needs you more.');
    const [first] = once.releases;
    if (!first) throw new Error('nothing shipped');
    const twice = { ...once, releases: [first, { ...first, window: 2 as const }] };
    expect(describe(twice)).toMatch(/^You shipped it 2 times\./);
  });
});

describe('release card placement', () => {
  it('never takes a card slot: the end game shows all three ending choices', () => {
    const all = TECHNOLOGY_IDS.slice();
    const rich = withTechnologies(all, 0, 100);
    // Plenty of tokens, so no recovery card competes for the surface.
    const end = { ...rich, economy: { ...rich.economy, tokens: 1e9 } };
    const game = selectGame(end, catalog);
    expect(game.offers.filter((o) => o.kind === 'choice').map((o) => o.id)).toEqual([
      'remove-oversight',
      'keep-approval',
      'expand-anyway',
    ]);
    expect(game.offers).toHaveLength(3);
    expect(game.release?.version).toBe('v0.1');
  });
});

function steps(run: RunState, count: number): RunState {
  let next = run;
  for (let i = 0; i < count; i += 1) next = stepRun(next, 100, catalog).run;
  return next;
}
