import { describe, expect, it } from 'vitest';
import { createRun } from './createRun';
import { deriveSeed, nextFloat } from './random';

describe('createRun', () => {
  it('starts a playing run with a healthy cat and no progress', () => {
    const run = createRun(1, 'run-1');
    expect(run.id).toBe('run-1');
    expect(run.status).toBe('playing');
    expect(run.activeMs).toBe(0);
    expect(run.projects).toEqual({});
    expect(run.economy.money).toBe(0);
    expect(run.stats.lifetimeOutput).toBe(0);
    expect(run.cat).toMatchObject({
      health: 100,
      mood: 85,
      fullness: 75,
      overfeeding: 0,
      alive: true,
    });
    expect(run.history).toEqual([]);
    expect(run.unlockedTechnologyIds).toEqual([]);
    expect(run.pendingUnlockIds).toEqual([]);
    expect(run.ending).toBeNull();
  });

  it('creates independent nested objects on every call', () => {
    const a = createRun(1, 'a');
    const b = createRun(1, 'b');
    a.cat.mood = 1;
    a.history.push({ kind: 'event', textId: 'x', activeMs: 0 });
    expect(b.cat.mood).toBe(85);
    expect(b.history).toEqual([]);
  });

  it('is deterministic for the same seed', () => {
    expect(createRun(77, 'r')).toEqual(createRun(77, 'r'));
    expect(createRun(77, 'r').rng).not.toEqual(createRun(78, 'r').rng);
  });

  it('keeps the visual stream separate from gameplay streams', () => {
    const run = createRun(3, 'r');
    // Consuming a presentation draw derived from the visual seed leaves the cat stream untouched.
    const visual = nextFloat(run.visualSeed);
    expect(visual.state).not.toBe(run.rng.cat);
    expect(run.rng.cat).toBe(deriveSeed(3, 'cat'));
    expect(run.visualSeed).toBe(deriveSeed(3, 'visual'));
  });
});
