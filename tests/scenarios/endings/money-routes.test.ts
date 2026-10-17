/**
 * AI Got My Job: reached only through the landlord wheel. A player who never takes a gig is
 * moved out by the first market update, misses rent month after month, and is evicted when the
 * red slice comes up. Public commands from `createRun` only.
 */
import { describe, expect, it } from 'vitest';
import { catalog } from '../../../src/content/catalog';
import { applyCommand } from '../../../src/game/commands';
import { createRun } from '../../../src/game/createRun';
import { frugalOf } from '../../../src/game/experience';
import { rentFor } from '../../../src/game/rent';
import { selectGame } from '../../../src/game/selectors';
import {
  acknowledgeReveals,
  baselineCare,
  baselinePrimary,
  playEvery,
  projectPlayer,
  type Policy,
} from '../../helpers/scenario';
import { expectEnding, newRun, playUntil } from '../../helpers/endingRoute';

/** Builds technologies, buys nothing with money, never freelances. */
const ignoresMoney: Policy[] = [
  projectPlayer({ freelanceBelowRents: 0 }),
  baselinePrimary,
  acknowledgeReveals,
  ...baselineCare,
  playEvery(),
];

describe('AI Got My Job', () => {
  it('missing rent month after month, the landlord wheel finally lands on EVICTED', () => {
    const run = playUntil(newRun(), ignoresMoney, (r) => r.status === 'ended', 40 * 60_000);
    expectEnding(run, 'ai-got-my-job');
    const last = run.rentWheels.at(-1);
    expect(last?.outcome).toBe('evicted');
    // Every spin before it missed a month too, and the red slice grew with the streak.
    const hazards = run.rentWheels.map((w) => w.hazard);
    expect(hazards).toEqual([...hazards].sort((a, b) => a - b));
    expect(run.rent.missedStreak).toBe(run.rentWheels.length);
    const view = selectGame(run, catalog);
    expect(view.ending?.illustrationId).toBe(
      run.ending?.catAlive ? 'ending-ai-got-my-job' : 'ending-ai-got-my-job-nocat',
    );
    // The wheels play in order; the last one can still be watched after the run ended.
    let watched = run;
    while (watched.rentWheelsSeen < watched.rentWheels.length - 1) {
      expect(selectGame(watched, catalog).rentWheel?.result.jackpot).toBe(false);
      watched = applyCommand(watched, { type: 'acknowledgeRentWheel' }, run.activeMs, catalog).run;
    }
    expect(selectGame(watched, catalog).rentWheel?.result.jackpot).toBe(true);
    const done = applyCommand(watched, { type: 'acknowledgeRentWheel' }, run.activeMs, catalog);
    expect(done.result).toBe('applied');
    expect(selectGame(done.run, catalog).rentWheel).toBeNull();
  });

  it('teaches a lesson of its own: live frugal, rent −10 % in every later run', () => {
    const run = playUntil(newRun(), ignoresMoney, (r) => r.status === 'ended', 40 * 60_000);
    const view = selectGame(run, catalog).ending;
    expect(view?.frugal).toEqual({ factor: 0.9, repeat: false });
    const frugal = frugalOf([{ id: 'ai-got-my-job' }], catalog);
    expect(frugal).toBe(0.9);
    const next = createRun(9, 'next', 0, frugal);
    expect(rentFor(next, 1, catalog)).toBe(90);
    expect(rentFor(next, 11, catalog)).toBe(Math.round(110 * 0.9));
  });
});
