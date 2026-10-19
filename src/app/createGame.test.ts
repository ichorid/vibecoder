import { describe, expect, it } from 'vitest';
import { createTestCatalog } from '../../tests/helpers/catalog';
import { createFakeClock, createFakeScheduler } from '../../tests/helpers/fakeClock';
import { createRun } from '../game/createRun';
import { createGame, type GameSnapshot } from './createGame';

function setup() {
  const clock = createFakeClock();
  const scheduler = createFakeScheduler();
  const game = createGame({
    catalog: createTestCatalog(),
    clock,
    scheduler,
    run: createRun(1, 'r'),
  });
  return { clock, scheduler, game };
}

describe('createGame store', () => {
  it('gives a subscriber the current snapshot immediately', () => {
    const { game } = setup();
    const seen: GameSnapshot[] = [];
    game.api.subscribe((s) => seen.push(s));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.run.activeMs).toBe(0);
  });

  it('stops notifying after unsubscribe', () => {
    const { game, clock, scheduler } = setup();
    let count = 0;
    const unsubscribe = game.api.subscribe(() => {
      count += 1;
    });
    game.start();
    unsubscribe();
    clock.advance(300);
    scheduler.fire();
    expect(count).toBe(1);
  });

  it('exposes only subscribe and dispatch, with a frozen snapshot', () => {
    const { game } = setup();
    expect(Object.keys(game.api).sort()).toEqual(['dispatch', 'subscribe']);
    let snapshot: GameSnapshot | undefined;
    game.api.subscribe((s) => {
      snapshot = s;
    });
    expect(Object.isFrozen(snapshot?.run.cat)).toBe(true);
    expect(() => {
      (snapshot?.run.economy as { money: number }).money = 1e9;
    }).toThrow();
  });

  it('settles elapsed time before applying input and publishes once', () => {
    const { game, clock } = setup();
    game.start();
    const seen: GameSnapshot[] = [];
    game.api.subscribe((s) => seen.push(s));
    clock.advance(250);
    expect(game.api.dispatch({ type: 'primaryAction' })).toBe('applied');
    expect(seen).toHaveLength(2);
    const after = seen[1];
    expect(after?.run.activeMs).toBe(200);
    expect(after?.run.stats.lifetimeOutput).toBe(0);
    expect(after?.run.economy.pendingManualWork).toBe(1);
  });

  it('does not produce twice for a re-processed timestamp', () => {
    const { game, clock, scheduler } = setup();
    game.start();
    let latest: GameSnapshot | undefined;
    game.api.subscribe((s) => {
      latest = s;
    });
    game.api.dispatch({ type: 'primaryAction' });
    clock.advance(100);
    scheduler.fire();
    scheduler.fire();
    game.api.dispatch({ type: 'primaryAction' });
    expect(latest?.run.stats.lifetimeOutput).toBe(1);
    expect(latest?.run.activeMs).toBe(100);
  });

  it('removes its timer on dispose and repeated dispose is safe', () => {
    const { game, scheduler } = setup();
    game.start();
    game.start();
    expect(scheduler.activeCount()).toBe(1);
    game.dispose();
    game.dispose();
    expect(scheduler.activeCount()).toBe(0);
  });

  it('reports committed facts of commands to an app listener (care events for sound effects)', () => {
    const facts: string[] = [];
    const game = createGame({
      catalog: createTestCatalog(),
      clock: createFakeClock(),
      scheduler: createFakeScheduler(),
      run: createRun(1, 'r'),
      onFacts: (list) =>
        facts.push(...list.map((f) => (f.type === 'catCared' ? `cared:${f.kind}` : f.type))),
    });
    game.api.dispatch({ type: 'petCat' });
    game.api.dispatch({ type: 'petCat' });
    expect(facts.filter((f) => f === 'cared:pet')).toHaveLength(1);
  });
});

describe('moments (docs/feature_build_deck.md §11)', () => {
  it('a completed build becomes one moment with its tier; nothing is replayed on a new snapshot', () => {
    const clock = createFakeClock();
    const scheduler = createFakeScheduler();
    const catalog = createTestCatalog();
    const base = createRun(1, 'm');
    const game = createGame({
      catalog,
      clock,
      scheduler,
      run: {
        ...base,
        projects: { release: { code: 1999, price: 2000 } },
        economy: { ...base.economy, pendingManualWork: 5 },
      },
    });
    const seen: GameSnapshot[] = [];
    game.api.subscribe((s) => seen.push(s));
    expect(seen[0]?.moments).toEqual([]);
    game.start();
    clock.advance(100);
    scheduler.fire();
    const moments = seen.at(-1)?.moments ?? [];
    expect(moments).toEqual([{ id: 1, kind: 'ready', key: 'release', tier: 'S' }]);
    clock.advance(100);
    scheduler.fire();
    expect(seen.at(-1)?.moments).toEqual(moments);
  });
});
