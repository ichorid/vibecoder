import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { build, clickAndSettle } from '../../tests/helpers/run';
import { createRun } from './createRun';
import { selectWorld } from './selectors';

describe('world projection', () => {
  it('carries unlocked IDs, the pending reveal and cat presentation facts', () => {
    const run = build(clickAndSettle(createRun(1, 'r'), 5, catalog), 'autocomplete', catalog);
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

  it('counts bought compute slots and shipped releases for the room', () => {
    const run = createRun(1, 'r');
    const bought = { ...run, upgradeLevels: { 'compute-slot': 3 } };
    expect(selectWorld(bought, catalog).computeSlots).toBe(3);
    expect(selectWorld(run, catalog).computeSlots).toBe(0);
    expect(selectWorld(run, catalog).releases).toBe(0);
  });
});

describe('construction sites in the world projection', () => {
  it('a technology being built shows as a site; the camera waits 2 s before leaning to it', async () => {
    const { act, AUTOCOMPLETE_PRICE, clickAndSettle, steps } =
      await import('../../tests/helpers/run');
    let run = clickAndSettle(createRun(1, 'r'), 5, catalog);
    // The original project, built from the start, is a frame on the wall.
    expect(selectWorld(run, catalog).sites).toContainEqual(
      expect.objectContaining({ kind: 'frame', id: '1', active: true }),
    );
    run = act(run, { type: 'selectProject', id: 'autocomplete' }, catalog);
    const site = () =>
      selectWorld(run, catalog).sites.find(
        (s) => s.kind === 'addition' && s.id === 'world-autocomplete',
      );
    expect(site()).toMatchObject({ progress: 0, active: true, framed: false });
    run = steps(run, 20, catalog);
    expect(site()).toMatchObject({ active: true, framed: true });
    // The release now waits, paused: its frame keeps its progress, its crane idles.
    expect(selectWorld(run, catalog).sites).toContainEqual(
      expect.objectContaining({ kind: 'frame', active: false }),
    );
    run = clickAndSettle(run, AUTOCOMPLETE_PRICE, catalog);
    expect(site()).toBeUndefined();
  });

  it('the rent notice: none before moving out, a bill after, red once a month was missed', () => {
    const run = createRun(1, 'r');
    expect(selectWorld(run, catalog).rentNotice).toBe('none');
    const out = { ...run, rent: { ...run.rent, movedOut: true, nextDueMs: 1 } };
    expect(selectWorld(out, catalog).rentNotice).toBe('notice');
    const late = { ...out, rent: { ...out.rent, missedStreak: 1 } };
    expect(selectWorld(late, catalog).rentNotice).toBe('overdue');
  });
});
