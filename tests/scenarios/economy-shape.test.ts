import { describe, expect, it } from 'vitest';
import { measureRun, type RunMetrics } from '../helpers/metrics';

/**
 * The economy contract (docs/economy_redesign.md §4, as reshaped by projects and money:
 * docs/feature_projects.md §9, docs/feature_money.md §9), measured with the same harness as
 * tools/tune.ts. Experience 0, PLAY-capable care, the 3 cps → one press every 3 s tapper who
 * picks the next build within a second and freelances below 1.5 rents, unless stated. Targets
 * not reached yet are listed as todos (journal).
 */
const cache = new Map<string, RunMetrics>();
function measured(key: string, run: () => RunMetrics): RunMetrics {
  const hit = cache.get(key);
  if (hit) return hit;
  const m = run();
  cache.set(key, m);
  return m;
}
const SEEDS = [1, 42] as const;
const baseline = (seed: number) => measured(`baseline-${seed}`, () => measureRun(seed));
const minutes = (m: RunMetrics) => m.companyMin ?? Infinity;

describe('economy shape (§4 contract)', { timeout: 300_000 }, () => {
  it('the 3 cps baseline reaches the company in 25–30 min (a 20–30 minute game)', () => {
    for (const seed of SEEDS) {
      expect(minutes(baseline(seed))).toBeGreaterThanOrEqual(25);
      expect(minutes(baseline(seed))).toBeLessThanOrEqual(30);
    }
  });

  it('every act ends within 1.5 min of 1 / 6.5 / 11.5 / 16 / 20.5 / 28.5', () => {
    const targets = [1, 6.5, 11.5, 16, 20.5, 28.5];
    for (const seed of SEEDS) {
      baseline(seed).acts.forEach((end, i) => {
        const off = Math.abs((end ?? Infinity) - (targets[i] ?? 0));
        expect(off, `seed ${seed} act ${i + 1}`).toBeLessThanOrEqual(1.5);
      });
    }
  });

  it('a card about every minute inside an act', () => {
    for (const seed of SEEDS) expect(baseline(seed).cadenceSec).toBeLessThanOrEqual(60);
  });

  it('a slower tapper (1 cps → one press every 5 s) finishes within 36 min', () => {
    const m = measured('slow', () => measureRun(1, { cps: 1, cpsAfter: 0.2 }));
    expect(minutes(m)).toBeLessThanOrEqual(36);
  });

  it('an idle player (one press a minute after the agent) finishes within 55 min', () => {
    const m = measured('idle', () => measureRun(1, { cpsAfter: 1 / 60, limitMin: 70 }));
    expect(minutes(m)).toBeLessThanOrEqual(55);
  });

  it('mashing at 10 cps is at most ~20 % faster than the baseline', () => {
    const m = measured('mash', () => measureRun(1, { cps: 10, cpsAfter: 10 }));
    expect(minutes(m)).toBeGreaterThanOrEqual(0.8 * minutes(baseline(1)));
  });

  it('buying the capacity the cards suggest is ≥ 10 % faster than progression only', () => {
    const greedy = measured('greedy', () => measureRun(1, { buyer: 'greedy' }));
    const saver = measured('saver', () => measureRun(1, { buyer: 'saver' }));
    expect(minutes(greedy)).toBeLessThanOrEqual(0.9 * minutes(saver));
  });

  it('coordination hurts (< 0.95) for 20–50 % of minutes 16–31', () => {
    for (const seed of SEEDS) {
      expect(baseline(seed).coordLowShare).toBeGreaterThanOrEqual(0.2);
      expect(baseline(seed).coordLowShare).toBeLessThanOrEqual(0.5);
    }
  });

  it('quality pressure exists late (< 0.9 for at least 15 % of minutes 16–31)', () => {
    for (const seed of SEEDS) expect(baseline(seed).qualityLowShare).toBeGreaterThanOrEqual(0.15);
  });

  it('Product Management → company takes 5–6 min (the money act)', () => {
    for (const seed of SEEDS) {
      expect(baseline(seed).pmToCompanyMin).toBeGreaterThanOrEqual(5);
      expect(baseline(seed).pmToCompanyMin).toBeLessThanOrEqual(6);
    }
  });

  it('freeze-features waits at least 60 s after Evaluations', () => {
    for (const seed of SEEDS) expect(baseline(seed).freezeDelaySec).toBeGreaterThanOrEqual(60);
  });

  // Owner decision D33: lessons stay +10 % each (+50 % with five), so a veteran replay with
  // every lesson takes about 19 min, a little under the first run's 20–30.
  it('five lessons learned (experience 0.5) still leave well over half the run', () => {
    for (const seed of SEEDS) {
      const m = measured(`xp-${seed}`, () => measureRun(seed, { experience: 0.5 }));
      expect(minutes(m)).toBeGreaterThanOrEqual(0.6 * minutes(baseline(seed)));
    }
  });

  it('an attentive player (picks within 5 s) still finishes within 30 min', () => {
    // Owner decision D33: the 20–30 min target is for an attentive player; a slow picker pays.
    for (const seed of SEEDS) {
      const m = measured(`react-5-${seed}`, () => measureRun(seed, { react: 5 }));
      expect(minutes(m)).toBeLessThanOrEqual(30);
      expect(m.taxedShareEarly).toBeLessThanOrEqual(0.15);
    }
  });

  it('a player who picks the next build within a second loses ≤ 3 % of code to drifting', () => {
    for (const seed of SEEDS) expect(baseline(seed).taxedShareEarly).toBeLessThanOrEqual(0.03);
  });

  it('a player who takes 15 s to pick loses 10–30 % before Manager Agent, ≤ 6 min overall', () => {
    const slow = measured('react-15', () => measureRun(1, { react: 15 }));
    expect(slow.taxedShareEarly).toBeGreaterThanOrEqual(0.1);
    expect(slow.taxedShareEarly).toBeLessThanOrEqual(0.3);
    expect(minutes(slow) - minutes(baseline(1))).toBeLessThanOrEqual(6);
  });

  it.todo('mashing at 10 cps is at most 10 % faster (measured 14–16 %)');
  it.todo('quality < 0.9 for 30–60 % of minutes 16–31 (measured 21–31 %)');
  it.todo('two optional cards visible ≥ 80 % of the time from 4 min (D29: only helpful capacity)');
  it.todo('act walls ≥ 2 min (measured 1.2–2.6)');
  it.todo('the seer buyer peaks at ≤ 120 debt (measured 37–328)');
  it.todo('an auto-refill v1 disaster costs 25–40 s of progress (measured 4–74 s)');
});
