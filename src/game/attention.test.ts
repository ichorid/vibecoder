import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { steps } from '../../tests/helpers/run';
import { updateAttention, visibleAttention } from './cat';
import { createCat, createRun } from './createRun';
import { selectCat } from './selectors';
import type { AttentionLevel, AttentionState, RunState } from './types';

const a = catalog.balance.attention;

/**
 * The schedule at a *fixed* mood (the pure rule). With a demanding cat the mood would cross
 * bands within one interval if the needs kept decaying, so band rules are checked here and the
 * integration with the simulation separately below.
 */
function schedule(mood: number) {
  const cat = { ...createCat(), mood };
  let state: AttentionState = { nextAtMs: null, visibleUntilMs: null, level: null, count: 0 };
  let at = 0;
  state = updateAttention(state, cat, at, a);
  return {
    advance(ms: number): AttentionLevel | null {
      for (let t = 0; t < ms; t += 100) {
        at += 100;
        state = updateAttention(state, cat, at, a);
      }
      return visibleAttention(state, at);
    },
  };
}

/** A run whose low mood has just been observed by one step (the schedule's origin). */
function withMood(mood: number, fullness = 90): RunState {
  const run = createRun(2, 'r');
  return steps({ ...run, cat: { ...run.cat, mood, fullness } }, 1, catalog);
}

function visibleAt(run: RunState) {
  return selectCat(run, catalog).attention;
}

describe('foreground attention schedule', () => {
  it('never intrudes at mood 40 or above', () => {
    const s = schedule(40);
    for (let i = 0; i < 20; i += 1) expect(s.advance(6000)).toBeNull();
  });

  it('shows a small intrusion for 4 s every 45 s at mood 20–39, first after one interval', () => {
    const s = schedule(35);
    expect(s.advance(a.smallIntervalMs - 100)).toBeNull();
    expect(s.advance(100)).toBe('small');
    expect(s.advance(a.smallDurationMs - 100)).toBe('small');
    expect(s.advance(100)).toBeNull();
    expect(s.advance(a.smallIntervalMs - a.smallDurationMs)).toBe('small');
  });

  it('shows a large intrusion for 6 s every 25 s below mood 20', () => {
    const s = schedule(10);
    expect(s.advance(a.largeIntervalMs)).toBe('large');
    expect(s.advance(a.largeDurationMs)).toBeNull();
  });

  it('shows at most one intrusion at a time and never queues missed ones', () => {
    const s = schedule(10);
    let windows = 0;
    let wasVisible = false;
    for (let i = 0; i < 6000; i += 1) {
      const visible = s.advance(100) !== null;
      if (visible && !wasVisible) windows += 1;
      wasVisible = visible;
    }
    expect(windows).toBe(Math.floor(600_000 / a.largeIntervalMs));
  });

  it('in the simulation a falling mood starts intrusions; a dead cat has none', () => {
    let run = withMood(45);
    let seen: AttentionLevel | null = null;
    for (let i = 0; i < 3000 && run.cat.alive && seen === null; i += 1) {
      run = steps(run, 1, catalog);
      seen = visibleAt(run).level;
    }
    expect(seen).not.toBeNull();
  });

  it('hides attention when mood recovers, the cat is dead, or the run ended', () => {
    const run = steps(withMood(10), a.largeIntervalMs / 100, catalog);
    expect(visibleAt(run).level).toBe('large');
    const happy = steps({ ...run, cat: { ...run.cat, mood: 80 } }, 1, catalog);
    expect(visibleAt(happy).level).toBeNull();
    const dead = { ...run, cat: { ...run.cat, alive: false, health: 0, diedAtActiveMs: 1 } };
    expect(visibleAt(dead).level).toBeNull();
    expect(visibleAt({ ...run, status: 'ended' }).level).toBeNull();
  });
});
