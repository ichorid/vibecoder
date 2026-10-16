import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { steps } from '../../tests/helpers/run';
import { applyCommand } from './commands';
import { updateAttention, updateCat, visibleAttention } from './cat';
import { createCat, createRun } from './createRun';
import { selectCat, selectGame, selectHistory } from './selectors';
import { stepRun } from './simulation';
import type { AttentionState, CatState, GameFact, RunState } from './types';

const balance = catalog.balance.cat;
const STRAY_MS = balance.strayAfterIgnoredMs;

/** Advance a cat that is kept fed (the bowl topped up) but otherwise left alone. */
function advance(state: CatState, ms: number): { cat: CatState; left: boolean } {
  let next = state;
  let left = false;
  for (let t = 0; t < ms && next.alive; t += 100) {
    const update = updateCat({ ...next, fullness: 100 }, 100, balance);
    next = update.cat;
    if (update.events.some((e) => e.type === 'left')) left = true;
  }
  return { cat: next, left };
}

/** Fed but ignored: mood in the attention-seeking band, fullness and health fine. */
const lonely = (overrides: Partial<CatState> = {}): CatState => ({
  ...createCat(),
  mood: balance.attentionBelow - 15,
  fullness: 100,
  ...overrides,
});

describe('an ignored cat leaves', () => {
  it('counts continuous attention-seeking active time and leaves once it reaches the limit', () => {
    const almost = advance(lonely(), STRAY_MS - balance.needsTickMs);
    expect(almost.cat.alive).toBe(true);
    expect(almost.cat.ignoredMs).toBe(STRAY_MS - balance.needsTickMs);
    const gone = advance(almost.cat, balance.needsTickMs);
    expect(gone.left).toBe(true);
    expect(gone.cat.alive).toBe(false);
    expect(gone.cat.health).toBeGreaterThan(0);
  });

  it('starts over when the mood climbs back out of the attention band', () => {
    const half = advance(lonely(), STRAY_MS / 2).cat;
    const cheered = advance({ ...half, mood: 100 }, balance.needsTickMs).cat;
    expect(cheered.ignoredMs).toBe(0);
    expect(advance({ ...cheered, mood: 50 }, STRAY_MS - balance.needsTickMs).cat.alive).toBe(true);
  });

  it('a critically weak cat is too weak to leave', () => {
    // No recovery, so it stays weak (and fed, so it does not starve) for the whole wait.
    const weakBalance = { ...balance, recoveryHealthPerMinute: 0 };
    let later = lonely({ health: balance.criticalBelow - 5 });
    for (let t = 0; t < STRAY_MS * 2; t += 100) {
      later = updateCat({ ...later, fullness: 100 }, 100, weakBalance).cat;
    }
    expect(later.alive).toBe(true);
    expect(later.ignoredMs).toBe(0);
  });
});

function aboutToLeave(): RunState {
  const run = createRun(4, 'r');
  return {
    ...run,
    activeMs: 600_000,
    cat: lonely({ ignoredMs: STRAY_MS - balance.needsTickMs, needsElapsedMs: 4900 }),
  };
}

function stepUntilGone(run: RunState): { run: RunState; facts: GameFact[] } {
  let current = run;
  const facts: GameFact[] = [];
  for (let i = 0; i < 100 && current.cat.alive; i += 1) {
    const t = stepRun(current, 100, catalog);
    current = t.run;
    facts.push(...t.facts);
  }
  return { run: current, facts };
}

describe('the stray transaction', () => {
  it('leaves without announcing: no log line, one history entry, one save fact', () => {
    const before = aboutToLeave();
    const { run, facts } = stepUntilGone(before);
    expect(run.cat.alive).toBe(false);
    expect(run.cat.leftAtActiveMs).toBe(600_100);
    expect(run.cat.diedAtActiveMs).toBeNull();
    expect(run.log).toEqual(before.log);
    expect(facts.filter((f) => f.type === 'catLeft')).toHaveLength(1);
    expect(facts.some((f) => f.type === 'catDied')).toBe(false);
    expect(run.history.filter((e) => e.kind === 'cat')).toEqual([
      { kind: 'cat', id: 'cat-left', activeMs: 600_100 },
    ]);
    expect(selectHistory(run, catalog).entries.at(-1)?.title).toBe(
      catalog.catText.history['cat-left'],
    );
    expect(selectCat(run, catalog).fate).toBe('stray');
  });

  it('a gone cat takes no care and never comes back', () => {
    const gone = stepUntilGone(aboutToLeave()).run;
    for (const type of ['feedCat', 'petCat', 'startCatPlay'] as const) {
      expect(applyCommand(gone, { type }, gone.activeMs + 5000, catalog).result).toBe(
        'unavailable',
      );
    }
    const later = steps(gone, 200, catalog);
    expect(later.cat.alive).toBe(false);
    expect(later.history.filter((e) => e.kind === 'cat')).toHaveLength(1);
  });

  it('endings remember the stray fate and use its text', () => {
    const gone = stepUntilGone(aboutToLeave()).run;
    const ended: RunState = {
      ...gone,
      status: 'ended',
      ending: { id: 'three-users', catAlive: false, catLeft: true, activeMs: gone.activeMs },
    };
    const definition = catalog.endings.find((e) => e.id === 'three-users');
    expect(selectGame(ended, catalog).ending?.paragraphs).toEqual(definition?.text.stray);
  });
});

describe('a critically weak cat stops signalling', () => {
  it('shows no intrusions however low the mood', () => {
    const cat = { ...createCat(), mood: 5, health: balance.criticalBelow - 1 };
    let state: AttentionState = { nextAtMs: null, visibleUntilMs: null, level: null, count: 0 };
    for (let at = 0; at < 120_000; at += 100) {
      state = updateAttention(state, cat, at, catalog.balance.attention);
      expect(visibleAttention(state, at)).toBeNull();
    }
    expect(state.count).toBe(0);
  });
});
