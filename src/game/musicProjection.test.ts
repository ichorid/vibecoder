import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { act, AUTOCOMPLETE_PRICE, clickAndSettle } from '../../tests/helpers/run';
import { createRun } from './createRun';
import { selectMusicProjection } from './selectors';
import type { RunState } from './types';

describe('music projection', () => {
  it('carries only unlocked technology IDs, the ended flag and the run ID', () => {
    const run = act(
      clickAndSettle(createRun(1, 'r'), AUTOCOMPLETE_PRICE, catalog),
      { type: 'buyUpgrade', id: 'autocomplete' },
      catalog,
    );
    expect(selectMusicProjection(run)).toEqual({
      technologyIds: ['autocomplete'],
      ended: false,
      runId: 'r',
    });
  });

  it('is identical whether the cat is healthy, hungry, sad or dead', () => {
    const base = createRun(7, 'same');
    const variants: RunState[] = [
      base,
      { ...base, cat: { ...base.cat, fullness: 0, mood: 0, health: 5 } },
      { ...base, cat: { ...base.cat, alive: false, health: 0, diedAtActiveMs: 1000 } },
    ];
    const projections = variants.map((run) => JSON.stringify(selectMusicProjection(run)));
    expect(new Set(projections).size).toBe(1);
    expect(Object.keys(selectMusicProjection(base)).sort()).toEqual([
      'ended',
      'runId',
      'technologyIds',
    ]);
  });
});
