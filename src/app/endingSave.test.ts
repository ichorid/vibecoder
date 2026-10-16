import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { withTechnologies } from '../../tests/helpers/unlock';
import { createFakeClock, createFakeScheduler } from '../../tests/helpers/fakeClock';
import { createMemoryStorage } from '../../tests/helpers/memoryStorage';
import { createRun } from '../game/createRun';
import type { RunState } from '../game/types';
import { TECHNOLOGY_IDS } from '../game/ids';
import { createProfile, createSaveAdapter, SAVE_KEY, type SaveData } from '../persistence/save';
import { createGame, type GameSnapshot } from './createGame';

function setup(
  storage = createMemoryStorage(),
  runId = 'run-1',
  adjust: (run: RunState) => RunState = (run) => run,
) {
  const clock = createFakeClock();
  const scheduler = createFakeScheduler();
  const loaded = createSaveAdapter(storage).load();
  const profile = loaded.status === 'loaded' ? loaded.save.profile : createProfile();
  const run = adjust(withTechnologies(createRun(5, runId), [...TECHNOLOGY_IDS], catalog));
  let seed = 100;
  const game = createGame({
    catalog,
    clock,
    scheduler,
    run,
    newRun: (experience) => createRun((seed += 1), `run-${seed}`, experience),
    persistence: { adapter: createSaveAdapter(storage), profile, revision: 0 },
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
  return { game, storage, tick, latest: () => latest };
}

const stored = (storage: ReturnType<typeof createMemoryStorage>) =>
  JSON.parse(storage.getItem(SAVE_KEY) ?? 'null') as SaveData;

describe('ending persistence', () => {
  it('writes the ending, its History entry and the profile discovery in one envelope', () => {
    const t = setup();
    t.tick(1000);
    const writes = t.storage.writes;
    expect(t.game.api.dispatch({ type: 'choose', id: 'remove-oversight' })).toBe('applied');
    expect(t.storage.writes).toBe(writes + 1);
    const save = stored(t.storage);
    expect(save.run.status).toBe('ended');
    expect(save.run.ending?.id).toBe('you-have-been-optimized');
    expect(save.run.history.at(-1)).toMatchObject({
      kind: 'ending',
      id: 'you-have-been-optimized',
    });
    expect(save.profile.endings).toEqual([
      { id: 'you-have-been-optimized', runId: 'run-1', activeMs: 1000, order: 1 },
    ]);
  });

  it('freezes the simulation after the ending', () => {
    const t = setup();
    t.game.api.dispatch({ type: 'choose', id: 'remove-oversight' });
    const frozen = t.latest().run;
    t.tick(60_000);
    expect(t.latest().run.activeMs).toBe(frozen.activeMs);
    expect(t.latest().run.cat).toEqual(frozen.cat);
  });

  it('restarts into a fresh run that keeps theme and discovered endings', () => {
    const t = setup();
    t.game.api.dispatch({ type: 'setTheme', theme: 'dark' });
    t.game.api.dispatch({ type: 'choose', id: 'remove-oversight' });
    const oldId = t.latest().run.id;
    expect(t.game.api.dispatch({ type: 'restart' })).toBe('applied');
    const fresh = t.latest();
    expect(fresh.run.id).not.toBe(oldId);
    expect(fresh.run.status).toBe('playing');
    expect(fresh.run.cat.alive).toBe(true);
    expect(fresh.run.unlockedTechnologyIds).toEqual([]);
    expect(fresh.profile.theme).toBe('dark');
    expect(fresh.history.endings.map((e) => e.title)).toEqual(['You Have Been Optimized']);
    const save = stored(t.storage);
    expect(save.run.id).toBe(fresh.run.id);
    expect(save.profile.endings).toHaveLength(1);
    t.tick(1000);
    expect(t.latest().run.activeMs).toBe(1000);
  });

  it('does not duplicate a rediscovered ending in the profile', () => {
    const storage = createMemoryStorage();
    const first = setup(storage);
    first.game.api.dispatch({ type: 'choose', id: 'remove-oversight' });
    first.game.dispose();
    const second = setup(storage, 'run-2');
    second.game.api.dispatch({ type: 'choose', id: 'remove-oversight' });
    expect(stored(storage).profile.endings).toHaveLength(1);
  });

  it('a lesson-learned ending raises experience, kept in the profile and given to the next run', () => {
    // The expansion has been losing money for a while: closing the company is on offer.
    const t = setup(createMemoryStorage(), 'run-1', (run) => ({
      ...run,
      choices: { 'expand-anyway': { atActiveMs: 0, manualActions: 0, overhead: 20 } },
      stats: { ...run.stats, negativeMarginMs: 200_000 },
    }));
    expect(t.game.api.dispatch({ type: 'choose', id: 'close-company' })).toBe('applied');
    expect(t.latest().game.ending?.experience).toEqual({ gained: 0.1, next: 0.1 });
    expect(stored(t.storage).profile.experience).toBe(0.1);
    t.game.api.dispatch({ type: 'restart' });
    expect(t.latest().run.experience).toBe(0.1);
  });
});
