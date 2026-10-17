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

describe('lessons and gigs (owner decision D34)', () => {
  it('a gig asks a veteran for a novice’s code and pays the same: it is just done sooner', async () => {
    const { offerGig } = await import('./gigs');
    const base = createRun(3, 'n');
    const novice = { ...base, economy: { ...base.economy, codeRate: 10 } };
    // The same player with five lessons writes 50 % more code per second.
    const veteran = { ...novice, experience: 0.5, economy: { ...novice.economy, codeRate: 15 } };
    const a = offerGig(novice, catalog).gigs.offer;
    const b = offerGig(veteran, catalog).gigs.offer;
    expect(b?.size).toBe(a?.size);
    expect(b?.payMin).toBe(a?.payMin);
    expect(b?.payMax).toBe(a?.payMax);
    expect((b?.size ?? 0) / 15).toBeLessThan((a?.size ?? 0) / 10);
  });
});

describe('the enterprise job pays seniors no more (owner decision D34)', () => {
  it('offers the same salary to a veteran as to a novice', async () => {
    const { maybeOfferJob } = await import('./job');
    const base = createRun(3, 'j');
    const novice = {
      ...base,
      rent: { ...base.rent, movedOut: true, month: 3 },
      economy: { ...base.economy, codeRate: 10 },
      // An offer for sure: a catalog where the recruiter always calls.
    };
    const always = {
      ...catalog,
      balance: { ...catalog.balance, job: { ...catalog.balance.job, offerChance: 1 } },
    };
    const veteran = { ...novice, experience: 0.5, economy: { ...novice.economy, codeRate: 15 } };
    const a = maybeOfferJob(novice, always).job.offer;
    const b = maybeOfferJob(veteran, always).job.offer;
    expect(a?.salary).toBeGreaterThan(0);
    expect(b?.salary).toBe(a?.salary);
  });
});
