import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { steps } from '../../tests/helpers/run';
import { createRun } from './createRun';
import { selectCat } from './selectors';
import type { RunState } from './types';

const a = catalog.balance.attention;

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
    const run = steps(withMood(60), 1200, catalog);
    expect(run.attention.nextAtMs).toBeNull();
    expect(visibleAt(run).level).toBeNull();
  });

  it('shows a small intrusion for 4 s every 45 s at mood 20–39, first after one interval', () => {
    let run = withMood(35);
    run = steps(run, a.smallIntervalMs / 100 - 1, catalog);
    expect(visibleAt(run).level).toBeNull();
    run = steps(run, 1, catalog);
    expect(visibleAt(run).level).toBe('small');
    run = steps(run, a.smallDurationMs / 100 - 1, catalog);
    expect(visibleAt(run).level).toBe('small');
    run = steps(run, 1, catalog);
    expect(visibleAt(run).level).toBeNull();
    run = steps(run, (a.smallIntervalMs - a.smallDurationMs) / 100, catalog);
    expect(visibleAt(run).level).toBe('small');
  });

  it('shows a large intrusion for 6 s every 25 s below mood 20', () => {
    let run = steps(withMood(10), a.largeIntervalMs / 100, catalog);
    expect(visibleAt(run).level).toBe('large');
    run = steps(run, a.largeDurationMs / 100, catalog);
    expect(visibleAt(run).level).toBeNull();
  });

  it('shows at most one intrusion at a time and never queues missed ones', () => {
    let run = withMood(10);
    let windows = 0;
    let wasVisible = false;
    for (let i = 0; i < 6000; i += 1) {
      run = steps(run, 1, catalog);
      const visible = visibleAt(run).level !== null;
      if (visible && !wasVisible) windows += 1;
      wasVisible = visible;
    }
    expect(windows).toBe(Math.floor(600_000 / a.largeIntervalMs));
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
