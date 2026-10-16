import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { createRun } from './createRun';
import { experienceOf } from './experience';
import { selectGame } from './selectors';

const found = (...ids: string[]) =>
  ids.map((id, i) => ({ id: id as never, runId: `r${i}`, activeMs: 1, order: i + 1 }));

describe('experience counts each lesson once', () => {
  it('is the sum over distinct lesson endings in the profile (at most +50 % today)', () => {
    expect(experienceOf(found('the-forgotten-project'), catalog)).toBeCloseTo(0.1, 9);
    expect(
      experienceOf(found('the-forgotten-project', 'you-have-been-optimized'), catalog),
    ).toBeCloseTo(0.1, 9);
    const all = catalog.endings.filter((e) => e.experience).map((e) => e.id);
    expect(experienceOf(found(...all), catalog)).toBeCloseTo(0.5, 9);
  });

  it('a repeat ending shows "already learned" and gains nothing', () => {
    const run = createRun(1, 'now', 0.1);
    const ended = {
      ...run,
      status: 'ended' as const,
      ending: { id: 'the-forgotten-project' as const, catAlive: true, catLeft: false, activeMs: 1 },
    };
    const before = [
      { id: 'the-forgotten-project' as const, runId: 'earlier', activeMs: 1, order: 1 },
    ];
    // Learned in an earlier run: the profile already holds it (endings are unique there).
    const repeat = selectGame(ended, catalog, before);
    expect(repeat.ending?.experience).toEqual({ gained: 0, next: 0.1, repeat: true });
    const first = selectGame(ended, catalog, [
      { id: 'the-forgotten-project', runId: 'now', activeMs: 1, order: 1 },
    ]);
    expect(first.ending?.experience).toEqual({ gained: 0.1, next: 0.1, repeat: false });
  });
});
