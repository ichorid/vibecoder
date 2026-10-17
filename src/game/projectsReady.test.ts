import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { createRun } from './createRun';
import { stepRun } from './simulation';
import type { RunState } from './types';

describe('a release that is built', () => {
  it('says so once (a fact for the chime), then polishes', () => {
    const run = createRun(1, 'ready');
    const almost = {
      ...run,
      projects: { release: { code: 1999, price: 2000 } },
      economy: { ...run.economy, pendingManualWork: 5 },
    };
    const step = stepRun(almost, 100, catalog);
    expect(step.facts).toContainEqual({ type: 'projectReady', id: 'release' });
    expect(step.run.projects.release).toEqual({ code: 2000, price: 2000 });
    const later = stepRun(
      { ...step.run, economy: { ...step.run.economy, pendingManualWork: 5 } },
      100,
      catalog,
    );
    expect(later.facts.some((f) => f.type === 'projectReady')).toBe(false);
  });
});

describe('a gig taken over a build', () => {
  it('returns the slot to that build once it is paid, at full speed (no drift)', async () => {
    const { act, build } = await import('../../tests/helpers/run');
    const base = createRun(2, 'resume');
    let run: RunState = {
      ...base,
      unlockedTechnologyIds: ['autocomplete' as const],
      upgradeLevels: { autocomplete: 1 },
      gigs: {
        offer: {
          size: 50,
          pay: 50,
          tier: 'normal' as const,
          payMin: 35,
          payMax: 65,
          clientId: 'dentist',
          paymentId: 'invoice',
        },
        search: null,
        paid: 0,
        botMs: 0,
      },
      narrative: { ...base.narrative, fired: ['first-gig'] },
    };
    run = act(run, { type: 'selectProject', id: 'generated-snippets' }, catalog);
    run = act(run, { type: 'selectProject', id: 'gig' }, catalog);
    expect(run.slots[0]).toMatchObject({
      target: 'gig',
      resume: { target: 'generated-snippets', by: 'player' },
    });
    run = build(run, 'gig', catalog);
    expect(run.gigs.paid).toBe(1);
    expect(run.slots[0]).toMatchObject({ target: 'generated-snippets', by: 'player' });
    expect(run.slots[0]?.resume).toBeUndefined();
  });
});
