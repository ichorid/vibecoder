import { describe, expect, it } from 'vitest';
import { planScene } from './scenePlan';

const base = { technologyIds: [] as string[], pendingRevealId: null as string | null };

describe('scene plan', () => {
  it('builds the room and every acknowledged addition statically on load', () => {
    const plan = planScene(
      new Set(),
      { ...base, technologyIds: ['autocomplete', 'generated-snippets'] },
      true,
    );
    expect(plan.build).toEqual(['room', 'world-autocomplete', 'world-generated-snippets']);
    expect(plan.reveal).toBeNull();
  });

  it('reveals a pending discovery only while Game is visible', () => {
    const projection = { technologyIds: ['autocomplete'], pendingRevealId: 'autocomplete' };
    const hidden = planScene(new Set(['room']), projection, false);
    expect(hidden.build).toEqual([]);
    expect(hidden.reveal).toBeNull();
    const shown = planScene(new Set(['room']), projection, true);
    expect(shown.reveal).toBe('world-autocomplete');
  });

  it('defers a pending reveal after reload and replays it when Game shows', () => {
    const projection = {
      technologyIds: ['autocomplete', 'generated-snippets'],
      pendingRevealId: 'generated-snippets',
    };
    const first = planScene(new Set(), projection, false);
    expect(first.build).toEqual(['room', 'world-autocomplete']);
    const built = new Set(first.build);
    expect(planScene(built, projection, true).reveal).toBe('world-generated-snippets');
  });

  it('never rebuilds what exists', () => {
    const plan = planScene(
      new Set(['room', 'world-autocomplete']),
      { ...base, technologyIds: ['autocomplete'] },
      true,
    );
    expect(plan.build).toEqual([]);
    expect(plan.reveal).toBeNull();
  });

  it('frames the camera on what is built', () => {
    const plan = planScene(
      new Set(['room']),
      { technologyIds: ['autocomplete'], pendingRevealId: 'autocomplete' },
      false,
    );
    expect(plan.envelopeIds).toEqual([]);
    const after = planScene(
      new Set(['room', 'world-autocomplete']),
      { technologyIds: ['autocomplete'], pendingRevealId: null },
      true,
    );
    expect(after.envelopeIds).toEqual(['autocomplete']);
  });
});
