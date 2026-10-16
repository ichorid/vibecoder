import { describe, expect, it } from 'vitest';
import { catalog } from '../../../src/content/catalog';
import { selectGame } from '../../../src/game/selectors';
import type { Policy } from '../../helpers/scenario';
import { acknowledgeReveals, baselineCare, every, pressPrimary } from '../../helpers/scenario';
import {
  baseline,
  choose,
  expectEnding,
  has,
  newRun,
  offered,
  playUntil,
  playUntilOffered,
} from '../../helpers/endingRoute';

describe('Three Users', () => {
  it('ships the original project modestly once an agent exists', () => {
    let run = playUntilOffered(newRun(), baseline, 'ship-original');
    expect(has(run, 'terminal-agent')).toBe(true);
    expect(run.stats.lifetimeOutput).toBeGreaterThanOrEqual(1000);
    run = choose(run, 'ship-original');
    expectEnding(run, 'three-users');
  });

  it('is not offered before the project is shippable', () => {
    const early = playUntil(newRun(), baseline, (r) => has(r, 'ai-native-ide'));
    expect(offered(early, 'ship-original')).toBe(false);
  });
});

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
    // "No extra review" from the start: the ordinary route minus review-capacity purchases.
    const noExtraReview: Policy[] = baseline.map(
      (policy) => (context) =>
        policy(context).filter((c) => !(c.type === 'buyUpgrade' && c.id === 'review-capacity')),
    );
    let run = playUntil(newRun(), noExtraReview, (r) => has(r, 'parallel-agents'));
    // Bad but real choices: drive the agents hard (PROMPT every second, buy tokens, agents and
    // compute); never review capacity or progression.
    const reckless: Policy[] = [
      every(1000, pressPrimary),
      acknowledgeReveals,
      ...baselineCare,
      ({ run: r, catalog: c }) => {
        const offers = selectGame(r, c).offers.flatMap((o) => (o.kind === 'upgrade' ? [o] : []));
        const pick = offers.find(
          (o) =>
            o.affordable && ['token-supply', 'additional-agent', 'compute-slot'].includes(o.id),
        );
        return pick ? [{ type: 'buyUpgrade', id: pick.id }] : [];
      },
    ];
    run = playUntilOffered(run, reckless, 'force-merge');
    expect(run.economy.debt).toBeGreaterThanOrEqual(150);
    run = choose(run, 'force-merge');
    expectEnding(run, 'the-great-merge-conflict');
  });
});

describe('The Greenest Pipeline', () => {
  it('keeps debt near zero after evaluations, then freezes feature work', () => {
    let run = playUntilOffered(newRun(), baseline, 'freeze-features');
    expect(has(run, 'evaluations')).toBe(true);
    expect(run.economy.debt).toBeLessThanOrEqual(5);
    run = choose(run, 'freeze-features');
    expectEnding(run, 'the-greenest-pipeline');
  });
});
