import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { createFakeClock, createFakeScheduler } from '../../tests/helpers/fakeClock';
import { createMemoryStorage } from '../../tests/helpers/memoryStorage';
import { playPhase, playPosition } from '../game/catPlaySession';
import { createRun } from '../game/createRun';
import type { CatPlayState, RunState } from '../game/types';
import { createProfile, createSaveAdapter } from '../persistence/save';
import { createGame, type GameSnapshot } from './createGame';

function setup(run: RunState = createRun(3, 'r'), storage = createMemoryStorage()) {
  const clock = createFakeClock();
  const scheduler = createFakeScheduler();
  const game = createGame({
    catalog,
    clock,
    scheduler,
    run,
    persistence: { adapter: createSaveAdapter(storage), profile: createProfile(), revision: 0 },
  });
  let latest!: GameSnapshot;
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
  const play = (): CatPlayState => {
    const p = latest.run.catPlay;
    if (!p) throw new Error('no play');
    return p as CatPlayState;
  };
  return { game, clock, tick, storage, latest: () => latest, play };
}

describe('PLAY across pause, resume, reload, leave and death', () => {
  it('freezes the attempt in the background and resumes with a cue, same position', () => {
    const t = setup();
    t.game.api.dispatch({ type: 'startCatPlay' });
    t.tick(1500);
    const before = t.play();
    const at = t.game.activeNow();
    const position = playPosition(before, at);
    const mood = t.latest().run.cat.mood;

    t.game.suspend('hidden');
    t.tick(120_000);
    expect(t.game.activeNow()).toBe(at);
    t.game.resume('hidden');

    const resumed = t.play();
    expect(resumed.attemptId).toBe(before.attemptId);
    expect(playPhase(resumed, t.game.activeNow())).toBe('resume');
    expect(playPosition(resumed, t.game.activeNow())).toBeCloseTo(position, 9);
    t.tick(400);
    expect(playPosition(t.play(), t.game.activeNow())).toBeCloseTo(position, 9);
    t.tick(100);
    expect(playPhase(t.play(), t.game.activeNow())).toBe('moving');
    expect(playPosition(t.play(), t.game.activeNow())).toBeCloseTo(position, 9);
    t.tick(100);
    expect(playPosition(t.play(), t.game.activeNow())).not.toBeCloseTo(position, 4);
    expect(t.latest().run.cat.mood).toBeLessThanOrEqual(mood);
  });

  it('does not give the needs or economy an extra pause during the cue', () => {
    const t = setup();
    t.game.api.dispatch({ type: 'startCatPlay' });
    t.tick(1500);
    t.game.suspend('blurred');
    t.game.resume('blurred');
    const active = t.latest().run.activeMs;
    t.tick(500);
    expect(t.latest().run.activeMs).toBe(active + 500);
  });

  it('restores the same attempt from a save after reload', () => {
    const storage = createMemoryStorage();
    const first = setup(createRun(3, 'r'), storage);
    first.game.api.dispatch({ type: 'startCatPlay' });
    first.tick(1200);
    const attempt = first.play();
    first.game.suspend('frozen');
    first.game.dispose();

    const loaded = createSaveAdapter(storage).load();
    if (loaded.status !== 'loaded') throw new Error('save missing');
    const second = setup(loaded.save.run, storage);
    second.game.api.dispatch({ type: 'resumeCatPlay' });
    expect(second.play().attemptId).toBe(attempt.attemptId);
    expect(playPhase(second.play(), second.game.activeNow())).toBe('resume');
  });

  it('cancels the session when the player leaves', () => {
    const t = setup();
    t.game.api.dispatch({ type: 'startCatPlay' });
    t.tick(1000);
    expect(t.game.api.dispatch({ type: 'leaveCatPlay' })).toBe('applied');
    expect(t.latest().run.catPlay).toBeNull();
  });

  it('cancels play permanently on death; late input gives no mood', () => {
    const base = createRun(3, 'r');
    const t = setup({
      ...base,
      cat: { ...base.cat, fullness: 0, health: 0.4, needsElapsedMs: 3000 },
    });
    t.game.api.dispatch({ type: 'startCatPlay' });
    t.tick(800);
    const attemptId = t.play().attemptId;
    t.tick(2500);
    expect(t.latest().run.cat.alive).toBe(false);
    expect(t.latest().run.catPlay).toBeNull();
    const moodAtDeath = t.latest().run.cat.mood;
    expect(t.game.api.dispatch({ type: 'catchMouse', attemptId })).toBe('unavailable');
    expect(t.game.api.dispatch({ type: 'startCatPlay' })).toBe('unavailable');
    expect(t.latest().run.cat.mood).toBe(moodAtDeath);
  });

  it('judges a catch at the event timestamp, not at dispatch time', () => {
    const t = setup();
    t.game.api.dispatch({ type: 'startCatPlay' });
    t.tick(1000);
    const p = t.play();
    const now = t.clock.now();
    t.game.api.dispatch({ type: 'catchMouse', attemptId: p.attemptId }, { timeStamp: now - 40 });
    const outcome = t.play().outcome;
    expect(outcome?.atMs).toBe(t.latest().run.activeMs - 40);
    expect(outcome?.position).toBeCloseTo(playPosition(p, t.latest().run.activeMs - 40), 9);
  });
});
