/**
 * P11.1 player strategies over the full catalog: deterministic, command-driven, current offers
 * only. Each route is capped; a stall reports the technologies, offers and rates at the cap.
 * Expectations are ranges and outcomes, never exact end times.
 */
import { describe, expect, it } from 'vitest';
import { catalog } from '../../src/content/catalog';
import { applyCommand } from '../../src/game/commands';
import { createRun } from '../../src/game/createRun';
import { deriveRates } from '../../src/game/economy';
import { selectCat, selectGame } from '../../src/game/selectors';
import { stepRun } from '../../src/game/simulation';
import type { RunState } from '../../src/game/types';
import {
  acknowledgeReveals,
  baselineBuyer,
  baselineCare,
  baselinePrimary,
  every,
  playEvery,
  pressPrimary,
  savingForReleases,
  shipWhenAffordable,
  CARE,
  type Policy,
} from '../helpers/scenario';

const CAP_MS = 60 * 60_000;
const MINUTE = 60_000;

interface Route {
  minutes: number;
  run: RunState;
  feeds: number;
  plays: number;
  pets: number;
  diedAtMin: number | null;
}

function route(seed: number, policies: readonly Policy[], label: string): Route {
  let run = createRun(seed, `${label}-${seed}`);
  let feeds = 0;
  let plays = 0;
  let pets = 0;
  while (run.activeMs < CAP_MS && !run.unlockedTechnologyIds.includes('autonomous-company')) {
    for (const policy of policies) {
      for (const command of policy({ run, catalog })) {
        const result = applyCommand(run, command, run.activeMs, catalog);
        if (result.result === 'applied') {
          if (command.type === 'feedCat') feeds += 1;
          if (command.type === 'petCat') pets += 1;
          if (command.type === 'startCatPlay') plays += 1;
        }
        run = result.run;
      }
    }
    run = stepRun(run, 100, catalog).run;
  }
  if (!run.unlockedTechnologyIds.includes('autonomous-company')) {
    const offers = selectGame(run, catalog).offers.map(
      (o) => `${o.id}${o.kind === 'upgrade' ? ` ${Math.round(o.price)}` : ''}`,
    );
    throw new Error(
      `${label} stalled at ${run.unlockedTechnologyIds.length}/28 after ${CAP_MS / MINUTE} min; offers: ${offers.join(', ')}; rates: ${JSON.stringify(deriveRates(run, catalog))}`,
    );
  }
  const minutes = run.activeMs / MINUTE;
  const diedAtMin = run.cat.diedAtActiveMs === null ? null : run.cat.diedAtActiveMs / MINUTE;
  console.info(
    `${label} seed ${seed}: company at ${minutes.toFixed(1)} min; cat ${run.cat.alive ? 'alive' : `died at ${diedAtMin?.toFixed(1)} min`}; feeds ${feeds}, pets ${pets}, plays ${plays}`,
  );
  return { minutes, run, feeds, plays, pets, diedAtMin };
}

const economy: Policy[] = [baselinePrimary, baselineBuyer, acknowledgeReveals];
const baseline: Policy[] = [...economy, ...baselineCare, playEvery()];

/** Pause all input during a visit to Cat/History (the game keeps running there). */
function withVisits(policies: readonly Policy[], everyMs: number, lengthMs: number): Policy[] {
  return policies.map(
    (policy) => (context) => (context.run.activeMs % everyMs < lengthMs ? [] : policy(context)),
  );
}

describe('player strategies (full catalog)', { timeout: 120_000 }, () => {
  for (const seed of [101, 202, 303, 404]) {
    it(`baseline care reaches the autonomous company in 25–35 active min with a living cat (seed ${seed})`, () => {
      const r = route(seed, baseline, 'baseline');
      expect(r.minutes).toBeGreaterThanOrEqual(25);
      expect(r.minutes).toBeLessThanOrEqual(35);
      expect(r.run.cat.alive).toBe(true);
    });
  }

  it('no care: the cat starves well before the end, the company still succeeds on time', () => {
    const r = route(101, economy, 'no-care');
    expect(r.run.cat.alive).toBe(false);
    expect(r.diedAtMin).not.toBeNull();
    expect(r.diedAtMin ?? Infinity).toBeLessThan(r.minutes);
    expect(r.minutes).toBeGreaterThanOrEqual(25);
    expect(r.minutes).toBeLessThanOrEqual(35);
  });

  it('the demanding cat needs a meal about every minute: feeding a third less often starves it', () => {
    const lazyFeeding: Policy[] = [
      ...economy,
      // Feed once the interval since the last meal has passed (a PLAY session may delay it).
      ({ run, catalog }) =>
        selectCat(run, catalog).alive &&
        !run.catPlay &&
        run.cat.fullness < 70 &&
        run.activeMs - (run.cat.lastFedAtActiveMs ?? -Infinity) >= (CARE.feedMs * 4) / 3
          ? [{ type: 'feedCat' }]
          : [],
      every(CARE.petMs, () => [{ type: 'petCat' }], CARE.petMs / 2),
      playEvery(),
    ];
    const r = route(202, lazyFeeding, 'lazy-feeding');
    expect(r.run.cat.alive).toBe(false);
    expect(r.minutes).toBeLessThanOrEqual(35);
  });

  it('PLAY a third less often (with normal feeding) still keeps the cat alive', () => {
    const r = route(
      202,
      [...economy, ...baselineCare, playEvery((CARE.playMs * 4) / 3)],
      'calm-play',
    );
    expect(r.run.cat.alive).toBe(true);
  });

  it('a slow player (presses every 3 s, then every 15 s) still finishes, later', () => {
    const slowPrimary: Policy = (context) => {
      const agents = (context.run.unlockedTechnologyIds as readonly string[]).includes(
        'terminal-agent',
      );
      return context.run.activeMs % (agents ? 15_000 : 3000) === 0 ? pressPrimary(context) : [];
    };
    const r = route(
      303,
      [slowPrimary, every(5000, baselineBuyer), acknowledgeReveals, ...baselineCare],
      'slow',
    );
    expect(r.minutes).toBeGreaterThan(30);
    expect(r.minutes).toBeLessThanOrEqual(55);
  });

  it('high-frequency input (10 presses per second) cannot trivialise the route', () => {
    const r = route(
      404,
      [every(100, pressPrimary), baselineBuyer, acknowledgeReveals, ...baselineCare],
      'mashing',
    );
    expect(r.minutes).toBeGreaterThanOrEqual(20);
  });

  it('overfeeding makes the cat sick for a while; normal care afterwards keeps it alive', () => {
    const overfeedEarly: Policy = ({ run, catalog }) =>
      run.activeMs < 6 * MINUTE && run.activeMs % 10_000 === 0 && selectCat(run, catalog).alive
        ? [{ type: 'feedCat' }]
        : [];
    let sawSick = false;
    const watch: Policy = ({ run, catalog }) => {
      if (selectCat(run, catalog).sick) sawSick = true;
      return [];
    };
    const r = route(101, [...baseline, overfeedEarly, watch], 'overfeed');
    expect(sawSick).toBe(true);
    expect(r.run.cat.alive).toBe(true);
  });

  it('pet-only care (never feeding) does not save the cat; success is unaffected', () => {
    const r = route(202, [...economy, every(30_000, () => [{ type: 'petCat' }])], 'pet-only');
    expect(r.run.cat.alive).toBe(false);
    expect(r.minutes).toBeLessThanOrEqual(35);
  });

  it('long Cat/History visits (no input for 2 of every 8 minutes) delay but never block', () => {
    const r = route(303, withVisits(baseline, 8 * MINUTE, 2 * MINUTE), 'visits');
    expect(r.minutes).toBeLessThanOrEqual(45);
  });

  it('temporarily bad purchases (every affordable optional card for 10 minutes) recover', () => {
    const greedy: Policy = ({ run, catalog }) => {
      if (run.activeMs >= 10 * MINUTE) return baselineBuyer({ run, catalog });
      const offer = selectGame(run, catalog).offers.find(
        (o) => o.kind === 'upgrade' && o.affordable,
      );
      return offer?.kind === 'upgrade' ? [{ type: 'buyUpgrade', id: offer.id }] : [];
    };
    const r = route(
      404,
      [baselinePrimary, greedy, acknowledgeReveals, ...baselineCare, playEvery()],
      'greedy',
    );
    expect(r.minutes).toBeLessThanOrEqual(46);
  });

  it('always ship: saving for every release still reaches the company, and ships them all', () => {
    // Seed 1 never hits the gold slice, so the run continues through all five windows.
    const shipper: Policy[] = [
      baselinePrimary,
      shipWhenAffordable,
      savingForReleases(baselineBuyer),
      acknowledgeReveals,
      ...baselineCare,
      playEvery(),
    ];
    const r = route(1, shipper, 'always-ship');
    expect(r.minutes).toBeGreaterThanOrEqual(25);
    expect(r.minutes).toBeLessThanOrEqual(46);
    // Then keep playing until the last release (v3.0, the one that never closes) ships.
    let run = r.run;
    const limit = run.activeMs + 20 * MINUTE;
    while (run.releases.length < 5 && run.activeMs < limit && run.status === 'playing') {
      for (const policy of shipper) {
        for (const command of policy({ run, catalog })) {
          run = applyCommand(run, command, run.activeMs, catalog).run;
        }
      }
      run = stepRun(run, 100, catalog).run;
    }
    console.info(
      `always-ship: releases ${run.releases.map((x) => `v${x.window}@${(x.activeMs / MINUTE).toFixed(1)}`).join(' ')}`,
    );
    expect(run.releases.map((x) => x.window)).toEqual([1, 2, 3, 4, 5]);
    expect(run.releases.some((x) => x.outcome === 'jackpot')).toBe(false);
  });
});
