import { describe, expect, it } from 'vitest';
import { catalog } from '../../../src/content/catalog';
import { selectGame } from '../../../src/game/selectors';
import type { Policy } from '../../helpers/scenario';
import {
  acknowledgeReveals,
  baselineCare,
  every,
  pressPrimary,
  projectPlayer,
} from '../../helpers/scenario';
import {
  baseline,
  choose,
  expectEnding,
  has,
  newRun,
  playUntil,
  playUntilOffered,
} from '../../helpers/endingRoute';

describe('The Last Programmer', () => {
  it('keeps manual work after the reviewer, then finishes by hand', () => {
    let run = playUntilOffered(newRun(), baseline, 'keep-manual');
    expect(has(run, 'reviewer')).toBe(true);
    run = choose(run, 'keep-manual');
    // The old action is really back, and automation offers are gone.
    expect(selectGame(run, catalog).primaryAction.label).toBe('WRITE CODE');
    expect(
      selectGame(run, catalog).offers.some(
        (o) => o.kind === 'upgrade' && o.id === 'parallel-agents',
      ),
    ).toBe(false);
    const manual: Policy[] = [every(1000, pressPrimary), acknowledgeReveals, ...baselineCare];
    run = playUntilOffered(run, manual, 'finish-by-hand');
    expect(
      run.stats.manualActions - (run.choices['keep-manual']?.manualActions ?? 0),
    ).toBeGreaterThanOrEqual(120);
    run = choose(run, 'finish-by-hand');
    expectEnding(run, 'the-last-programmer');
  });
});

describe('The Great Merge Conflict', () => {
  it('accumulates debt with parallel agents and no extra review, then forces the merge', () => {
    // "No extra review" from the start: the ordinary route minus review-capacity builds.
    const noExtraReview: Policy[] = baseline.map(
      (policy) => (context) =>
        policy(context).filter(
          (c) =>
            !(c.type === 'buyUpgrade' && c.id === 'review-capacity') &&
            !(c.type === 'selectProject' && c.id === 'review-capacity'),
        ),
    );
    let run = playUntil(newRun(), noExtraReview, (r) => has(r, 'parallel-agents'));
    // Bad but real choices: drive the agents hard (PROMPT every second, buy tokens and compute,
    // build agents); never review capacity or progression. Rent still gets paid with gigs.
    const keepsTheLightsOn = projectPlayer({ capacity: 'none' });
    const reckless: Policy[] = [
      ({ run: r, catalog: c }) => {
        const money = keepsTheLightsOn({ run: r, catalog: c }).filter(
          (cmd) =>
            cmd.type === 'searchJob' ||
            (cmd.type === 'selectProject' && cmd.id === 'gig') ||
            (cmd.type === 'buyUpgrade' && cmd.id === 'token-supply'),
        );
        if (money.length > 0) return money;
        if (r.slots.some((slot) => slot.target === 'gig' && slot.by === 'player')) return [];
        const offers = selectGame(r, c).offers.flatMap((o) => (o.kind === 'upgrade' ? [o] : []));
        const compute = offers.find(
          (o) => o.id === 'compute-slot' && o.affordable && r.economy.money - o.price > 100,
        );
        if (compute) return [{ type: 'buyUpgrade', id: 'compute-slot' }];
        const building = r.slots.some((slot) => slot.target === 'additional-agent');
        return offers.some((o) => o.id === 'additional-agent') && !building
          ? [{ type: 'selectProject', id: 'additional-agent' }]
          : [];
      },
      every(1000, pressPrimary),
      acknowledgeReveals,
      ...baselineCare,
    ];
    run = playUntilOffered(run, reckless, 'force-merge');
    expect(run.economy.debt).toBeGreaterThanOrEqual(150);
    run = choose(run, 'force-merge');
    expectEnding(run, 'the-great-merge-conflict');
  });
});

describe('The Greenest Pipeline', () => {
  it('keeps debt near zero after evaluations, then freezes feature work', () => {
    // The ordinary route to Evaluations; then a careful player: reviewers first, no new
    // features (the release is what gets built), money from gigs as usual.
    let run = playUntil(newRun(), baseline, (r) => has(r, 'evaluations'));
    const ordinary = projectPlayer();
    const careful: Policy = (context) => {
      const { run: r, catalog: c } = context;
      const moneyAndPacks = ordinary(context).filter(
        (cmd) =>
          cmd.type === 'searchJob' ||
          cmd.type === 'buyUpgrade' ||
          (cmd.type === 'selectProject' && cmd.id === 'gig'),
      );
      if (moneyAndPacks.length > 0) return moneyAndPacks;
      if (r.slots.some((slot) => slot.target === 'gig' && slot.by === 'player')) return [];
      const review = selectGame(r, c).offers.some((o) => o.id === 'review-capacity');
      const slot = r.slots.find((s) => s.target !== 'review-capacity' && s.target !== 'release');
      if (review && !r.slots.some((s) => s.target === 'review-capacity')) {
        return [{ type: 'selectProject', id: 'review-capacity' }];
      }
      return slot ? [{ type: 'selectProject', id: 'release' }] : [];
    };
    run = playUntilOffered(
      run,
      [careful, ...baseline.filter((p) => p !== baseline[1])],
      'freeze-features',
    );
    expect(has(run, 'evaluations')).toBe(true);
    expect(run.economy.debt).toBeLessThanOrEqual(5);
    run = choose(run, 'freeze-features');
    expectEnding(run, 'the-greenest-pipeline');
  });
});
