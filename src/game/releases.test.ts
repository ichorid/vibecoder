import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { applyCommand } from './commands';
import type { Catalog } from './catalog';
import { createRun } from './createRun';
import { TECHNOLOGY_IDS, type TechnologyId } from './ids';
import { jackpotHazard, openReleaseWindow } from './releases';
import { selectGame, selectRelease } from './selectors';
import { stepRun } from './simulation';
import type { RunState } from './types';

const windows = catalog.releases.windows;
const WINDOW_TECHS = windows.map((w) => w.technology);

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

const later = (run: RunState, ids: readonly TechnologyId[], at: number): RunState => ({
  ...run,
  activeMs: at,
  unlockedTechnologyIds: [...run.unlockedTechnologyIds, ...ids],
  history: [
    ...run.history,
    ...ids.map((id) => ({ kind: 'technology' as const, id, activeMs: at })),
  ],
});

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
    const hazards = windows.map((_, i) => jackpotHazard(windows, i));
    const expected = [0.002, 0.00802, 0.0202, 0.05155, 0.13043];
    hazards.forEach((h, i) => expect(h).toBeCloseTo(expected[i] ?? 0, 4));
    expect(hazards.reduce((p, h) => p * (1 - h), 1)).toBeCloseTo(0.8, 10);
  });
});

describe('launch windows', () => {
  it('open on the unlock of their technology, never before and never after the run ended', () => {
    expect(openReleaseWindow(withTechnologies(['autocomplete']), catalog)).toBeNull();
    const run = withTechnologies(['autocomplete', 'terminal-agent']);
    expect(openReleaseWindow(run, catalog)?.window).toBe(1);
    expect(openReleaseWindow({ ...run, status: 'ended' }, catalog)).toBeNull();
  });

  it('close only when three more technologies AND 240 s have passed; the last never closes', () => {
    const open = withTechnologies(['terminal-agent'], 1000);
    const three: TechnologyId[] = ['autonomous-edits', 'tool-permissions', 'ralph-loop'];
    expect(openReleaseWindow(later(open, three, 1000 + 239_000), catalog)?.window).toBe(1);
    expect(openReleaseWindow(later(open, three.slice(0, 2), 1000 + 400_000), catalog)?.window).toBe(
      1,
    );
    expect(openReleaseWindow(later(open, three, 1000 + 240_000), catalog)).toBeNull();

    const last = withTechnologies(['autonomous-company'], 0);
    expect(openReleaseWindow({ ...last, activeMs: 3_600_000 }, catalog)?.window).toBe(5);
  });

  it('log a line when a window opens and when an unshipped one closes', () => {
    let run = withTechnologies(['terminal-agent'], 0, 0);
    run = stepRun(run, 100, catalog).run;
    expect(run.log.map((l) => l.text)).toContain(`🚢 ${windows[0]?.description}`);
    run = later(run, ['autonomous-edits', 'tool-permissions', 'ralph-loop'], 300_000);
    run = stepRun(run, 100, catalog).run;
    expect(run.log.map((l) => l.text)).toContain('⌛ The launch window for v0.1 closed.');
    const again = stepRun(run, 100, catalog).run;
    expect(again.log.filter((l) => l.text.includes('closed'))).toHaveLength(1);
  });
});

describe('shipping a release', () => {
  it('is rejected when closed, already shipped, unaffordable or after the end', () => {
    expect(ship(withTechnologies(['autocomplete'])).result).toBe('unavailable');
    const run = withTechnologies(['terminal-agent'], 0, 1999);
    expect(ship(run).result).toBe('unaffordable');
    const rich = withTechnologies(['terminal-agent']);
    const shipped = ship(rich, withWeights([0])).run;
    expect(ship(shipped).result).toBe('unavailable');
    expect(ship({ ...rich, status: 'ended' }).result).toBe('unavailable');
  });

  it('spends exactly the price from the balance and leaves lifetime output alone', () => {
    const run = withTechnologies(['terminal-agent'], 0, 5000);
    const shipped = ship(run, withWeights([0]));
    expect(shipped.result).toBe('applied');
    expect(shipped.run.economy.output).toBe(3000);
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
    let run = withTechnologies(WINDOW_TECHS);
    for (let i = 0; i < 5; i += 1) run = ship(run, noJackpot).run;
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

  it('the release card is a decision card with its price', () => {
    const run = withTechnologies(
      ['autocomplete', 'generated-snippets', 'ai-native-ide', 'terminal-agent'],
      0,
      100,
    );
    const card = selectGame(run, catalog).offers.find((o) => o.kind === 'release');
    expect(card).toMatchObject({ kind: 'release', title: 'Ship v0.1', price: 2000 });
    expect(card?.kind === 'release' && card.affordable).toBe(false);
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
  it('never hides an ending choice; in the end game it is a fourth card', () => {
    const all = TECHNOLOGY_IDS.slice();
    const rich = withTechnologies(all, 0, 100);
    // Plenty of tokens, so no recovery card competes for the surface.
    const end = { ...rich, economy: { ...rich.economy, tokens: 1e9 } };
    const offers = selectGame(end, catalog).offers;
    expect(offers.filter((o) => o.kind === 'choice').map((o) => o.id)).toEqual([
      'remove-oversight',
      'keep-approval',
      'expand-anyway',
    ]);
    expect(offers.at(-1)?.kind).toBe('release');
    expect(offers).toHaveLength(4);
  });
});

function steps(run: RunState, count: number): RunState {
  let next = run;
  for (let i = 0; i < count; i += 1) next = stepRun(next, 100, catalog).run;
  return next;
}
