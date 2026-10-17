import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { applyCommand } from './commands';
import { createRun } from './createRun';
import { deriveRates } from './economy';
import { selectGame } from './selectors';
import { stepRun } from './simulation';

describe('experience from earlier runs', () => {
  it('multiplies every source of code: presses, passive code and the agents', () => {
    const plain = createRun(1, 'a');
    const seasoned = createRun(1, 'b', 0.3);
    expect(deriveRates(seasoned, catalog).manualOutput).toBeCloseTo(
      deriveRates(plain, catalog).manualOutput * 1.3,
      9,
    );
    const press = (run: typeof plain) =>
      stepRun(applyCommand(run, { type: 'primaryAction' }, 0, catalog).run, 100, catalog).run.stats
        .lifetimeOutput;
    expect(press(seasoned)).toBeCloseTo(press(plain) * 1.3, 9);
  });

  it('lesson-learned endings say what the next run gets', () => {
    const run = createRun(1, 'r', 0.2);
    const ended = {
      ...run,
      status: 'ended' as const,
      ending: { id: 'the-forgotten-project' as const, catAlive: true, catLeft: false, activeMs: 1 },
    };
    // Next run's experience is derived from the profile's distinct lesson endings (D1).
    expect(selectGame(ended, catalog).ending?.experience).toEqual({
      gained: 0.1,
      next: 0.1,
      repeat: false,
    });
    const other = { ...ended, ending: { ...ended.ending, id: 'you-have-been-optimized' as const } };
    expect(selectGame(other, catalog).ending?.experience).toBeNull();
  });

  it('five endings teach a lesson', () => {
    expect(catalog.endings.filter((e) => e.experience).map((e) => e.id)).toEqual([
      'the-last-programmer',
      'the-great-merge-conflict',
      'the-greenest-pipeline',
      'the-forgotten-project',
      'fully-automated-bankruptcy',
    ]);
  });
});
