import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { createFakeClock, createFakeScheduler } from '../../tests/helpers/fakeClock';
import { createMemoryStorage } from '../../tests/helpers/memoryStorage';
import { AUTOCOMPLETE_PRICE, IDE_PRICE, SNIPPETS_PRICE } from '../../tests/helpers/run';
import { createRun } from '../game/createRun';
import { SAVE_KEY, createProfile, createSaveAdapter, type SaveData } from '../persistence/save';
import { createGame, type GameSnapshot } from './createGame';

function setup(storage = createMemoryStorage()) {
  const clock = createFakeClock();
  const scheduler = createFakeScheduler();
  const adapter = createSaveAdapter(storage);
  const loaded = adapter.load();
  const save = loaded.status === 'loaded' ? loaded.save : null;
  const game = createGame({
    catalog,
    clock,
    scheduler,
    run: save?.run ?? createRun(1, 'run-1'),
    persistence: {
      adapter,
      profile: save?.profile ?? createProfile(),
      revision: save?.revision ?? 0,
    },
  });
  let latest: GameSnapshot | undefined;
  game.api.subscribe((s) => {
    latest = s;
  });
  game.start();
  const tick = (ms: number) => {
    for (let t = 0; t < ms; t += 100) {
      clock.advance(100);
      scheduler.fire();
    }
  };
  return { storage, clock, scheduler, game, tick, latest: () => latest };
}

function stored(storage: ReturnType<typeof createMemoryStorage>): SaveData {
  return JSON.parse(storage.getItem(SAVE_KEY) ?? 'null') as SaveData;
}

/** Presses `count` times; by default at the tap pace (about 3 per second), so every press counts. */
function click(t: ReturnType<typeof setup>, count: number, everyMs = 400) {
  for (let i = 0; i < count; i += 1) {
    t.game.api.dispatch({ type: 'primaryAction' });
    t.tick(everyMs);
  }
}

describe('autosave', () => {
  it('saves a dirty run after five active seconds, not before', () => {
    const t = setup();
    t.game.api.dispatch({ type: 'primaryAction' });
    t.tick(4900);
    expect(t.storage.writes).toBe(0);
    t.tick(100);
    expect(t.storage.writes).toBe(1);
    expect(stored(t.storage).run.activeMs).toBe(5000);
  });

  it('coalesces primary clicks into the periodic save', () => {
    const t = setup();
    click(t, 30, 100);
    expect(t.storage.writes).toBe(0);
  });

  it('writes immediately when a build discovers a technology', () => {
    const t = setup();
    click(t, 5);
    expect(t.game.api.dispatch({ type: 'selectProject', id: 'autocomplete' })).toBe('applied');
    click(t, AUTOCOMPLETE_PRICE - 1);
    // Building takes longer than the periodic save; the discovery still writes at once.
    t.game.api.dispatch({ type: 'primaryAction' });
    const writes = t.storage.writes;
    t.tick(100);
    expect(t.storage.writes).toBe(writes + 1);
    expect(stored(t.storage).run.unlockedTechnologyIds).toEqual(['autocomplete']);
  });

  it('does not write again on a tick right after a save', () => {
    const t = setup();
    t.tick(5000);
    const writes = t.storage.writes;
    t.tick(100);
    expect(t.storage.writes).toBe(writes);
  });

  it('keeps the in-memory run and reports failure when storage refuses writes', () => {
    const t = setup();
    t.storage.failWrites = true;
    click(t, 5);
    t.game.api.dispatch({ type: 'selectProject', id: 'autocomplete' });
    click(t, AUTOCOMPLETE_PRICE);
    expect(t.latest()?.save.status).toBe('failed');
    expect(t.latest()?.run.unlockedTechnologyIds).toEqual(['autocomplete']);
    t.storage.failWrites = false;
    t.game.api.dispatch({ type: 'retrySave' });
    expect(t.latest()?.save.status).toBe('ok');
    expect(stored(t.storage).run.unlockedTechnologyIds).toEqual(['autocomplete']);
  });

  it('saves already-settled elapsed time on suspension', () => {
    const t = setup();
    t.clock.advance(350);
    t.game.suspend('hidden');
    expect(stored(t.storage).run.activeMs).toBe(300);
  });

  it('does not reapply purchase effects after reload', () => {
    const first = setup();
    click(first, 5);
    first.game.api.dispatch({ type: 'selectProject', id: 'autocomplete' });
    click(first, AUTOCOMPLETE_PRICE);
    first.game.dispose();
    const second = setup(first.storage);
    const run = second.latest()?.run;
    expect(run?.unlockedTechnologyIds).toEqual(['autocomplete']);
    expect(run?.history.filter((e) => e.kind === 'technology')).toHaveLength(1);
    const before = run?.stats.lifetimeOutput ?? 0;
    second.game.api.dispatch({ type: 'primaryAction' });
    second.tick(100);
    expect(second.latest()?.run.stats.lifetimeOutput).toBe(before + 2);
  });
});

describe('passive output and pause', () => {
  it('produces no IDE output while the page is hidden', () => {
    const t = setup();
    const buy = (id: 'autocomplete' | 'generated-snippets' | 'ai-native-ide', clicks: number) => {
      expect(t.game.api.dispatch({ type: 'selectProject', id })).toBe('applied');
      click(t, clicks);
      t.game.api.dispatch({ type: 'acknowledgeUnlock', id });
    };
    click(t, 5);
    buy('autocomplete', AUTOCOMPLETE_PRICE);
    buy('generated-snippets', Math.ceil(SNIPPETS_PRICE / 2));
    buy('ai-native-ide', Math.ceil(IDE_PRICE / 4));
    t.tick(1000);
    const before = t.latest()?.run.stats.lifetimeOutput ?? 0;
    expect(before).toBeGreaterThan(0);
    t.game.suspend('hidden');
    t.tick(60_000);
    t.game.resume('hidden');
    expect(t.latest()?.run.stats.lifetimeOutput).toBe(before);
    t.tick(1000);
    expect(t.latest()?.run.stats.lifetimeOutput).toBeCloseTo(before + 1, 6);
  });
});
