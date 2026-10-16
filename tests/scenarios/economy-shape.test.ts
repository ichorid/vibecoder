import { describe, expect, it } from 'vitest';
import { measureRun, type RunMetrics } from '../helpers/metrics';

/**
 * The economy contract (docs/economy_redesign.md §4), measured with the same harness as
 * tools/tune.ts. Experience 0, PLAY-capable care, the 3 cps → one press every 3 s tapper unless
 * stated. Targets not reached yet are listed as todos (journal, economy redesign E4–E8).
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
  it('the 3 cps baseline reaches the company in 28–31 min', () => {
    for (const seed of SEEDS) {
      expect(minutes(baseline(seed))).toBeGreaterThanOrEqual(28);
      expect(minutes(baseline(seed))).toBeLessThanOrEqual(31);
    }
  });

  it('acts 3, 4 and 6 end within 1.5 min of 13 / 18 / 30', () => {
    for (const seed of SEEDS) {
      const [, , three, four, , six] = baseline(seed).acts;
      expect(Math.abs((three ?? Infinity) - 13)).toBeLessThanOrEqual(1.5);
      expect(Math.abs((four ?? Infinity) - 18)).toBeLessThanOrEqual(1.5);
      expect(Math.abs((six ?? Infinity) - 30)).toBeLessThanOrEqual(1.5);
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
    for (const seed of SEEDS) {
      expect(baseline(seed).freezeDelaySec).toBeGreaterThanOrEqual(60);
    }
  });

  it('five lessons learned (experience 0.5) still leave a 20-minute run', () => {
    for (const seed of SEEDS) {
      const m = measured(`xp-${seed}`, () => measureRun(seed, { experience: 0.5 }));
      expect(minutes(m)).toBeGreaterThanOrEqual(20);
    }
  });

  it.todo('mashing at 10 cps is at most 10 % faster (measured 14–16 %)');
  it.todo('acts 1, 2 and 5 end near 3 / 8 / 24 (measured 0.5 / 5.7 / 21.5–23)');
  it.todo('quality < 0.9 for 30–60 % of minutes 16–31 (measured 21–31 %)');
  it.todo('two optional cards visible ≥ 80 % of the time from 4 min (D29: only helpful capacity)');
  it.todo('act walls ≥ 2 min (measured 1.2–2.6)');
  it.todo('the seer buyer peaks at ≤ 120 debt (measured 37–328)');
  it.todo('an auto-refill v1 disaster costs 25–40 s of progress (measured 4–74 s)');
});
