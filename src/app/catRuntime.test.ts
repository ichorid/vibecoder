import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { createFakeClock, createFakeScheduler } from '../../tests/helpers/fakeClock';
import { createRun } from '../game/createRun';
import { createGame, type GameSnapshot } from './createGame';

describe('cat and the runtime clock', () => {
  it('does not change the cat during five minutes of hidden time', () => {
    const clock = createFakeClock();
    const scheduler = createFakeScheduler();
    const game = createGame({ catalog, clock, scheduler, run: createRun(1, 'r') });
    let latest: GameSnapshot | undefined;
    game.api.subscribe((s) => {
      latest = s;
    });
    game.start();
    game.suspend('hidden');
    for (let i = 0; i < 3000; i += 1) {
      clock.advance(100);
      scheduler.fire();
    }
    game.resume('hidden');
    game.runtime.settle();
    expect(latest?.run.cat).toMatchObject({ fullness: 75, mood: 85, health: 100 });
    expect(latest?.run.activeMs).toBe(0);
  });
});

describe('death and saving', () => {
  it('requests an immediate save when the cat dies', async () => {
    const { createMemoryStorage } = await import('../../tests/helpers/memoryStorage');
    const { createProfile, createSaveAdapter } = await import('../persistence/save');
    const clock = createFakeClock();
    const scheduler = createFakeScheduler();
    const storage = createMemoryStorage();
    const base = createRun(1, 'r');
    const game = createGame({
      catalog,
      clock,
      scheduler,
      run: { ...base, cat: { ...base.cat, fullness: 0, health: 0.5, needsElapsedMs: 4800 } },
      persistence: { adapter: createSaveAdapter(storage), profile: createProfile(), revision: 0 },
    });
    game.start();
    clock.advance(100);
    scheduler.fire();
    expect(storage.writes).toBe(0);
    clock.advance(100);
    scheduler.fire();
    expect(storage.writes).toBe(1);
    expect(storage.getItem('vibe-coder.save')).toContain('"alive":false');
  });
});
