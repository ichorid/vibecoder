import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { act, clickAndSettle } from '../../tests/helpers/run';
import { createRun } from './createRun';
import { selectWorld } from './selectors';

describe('world projection', () => {
  it('carries unlocked IDs, the pending reveal and cat presentation facts', () => {
    const run = act(
      clickAndSettle(createRun(1, 'r'), 10, catalog),
      { type: 'buyUpgrade', id: 'autocomplete' },
      catalog,
    );
    const world = selectWorld(run, catalog);
    expect(world.technologyIds).toEqual(['autocomplete']);
    expect(world.pendingRevealId).toBe('autocomplete');
    expect(world.cat).toEqual({ alive: true, presentation: 'normal', round: false });
  });

  it('marks a dead cat so no renderer can draw it', () => {
    const run = createRun(1, 'r');
    const dead = { ...run, cat: { ...run.cat, alive: false, health: 0, diedAtActiveMs: 1 } };
    expect(selectWorld(dead, catalog).cat.alive).toBe(false);
    expect(selectWorld(dead, catalog).cat.presentation).toBe('dead');
  });

  it('reflects an overfed cat as round', () => {
    const run = createRun(1, 'r');
    expect(selectWorld({ ...run, cat: { ...run.cat, overfeeding: 50 } }, catalog).cat.round).toBe(
      true,
    );
  });
});
