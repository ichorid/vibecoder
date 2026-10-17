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

  it('acts 1, 3, 4 and 6 end within 1.5 min of 1 / 12 / 16.5 / 28', () => {
    for (const seed of SEEDS) {
      const [one, , three, four, , six] = baseline(seed).acts;
      expect(Math.abs((one ?? Infinity) - 1)).toBeLessThanOrEqual(1.5);
      expect(Math.abs((three ?? Infinity) - 12)).toBeLessThanOrEqual(1.5);
      expect(Math.abs((four ?? Infinity) - 16.5)).toBeLessThanOrEqual(1.5);
      expect(Math.abs((six ?? Infinity) - 28)).toBeLessThanOrEqual(1.5);
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

  it('quality pressure exists late (< 0.9 for at least 10 % of minutes 16–31)', () => {
    for (const seed of SEEDS) expect(baseline(seed).qualityLowShare).toBeGreaterThanOrEqual(0.1);
  });

  it('Product Management → company takes about 5–6 min (the money act)', () => {
    for (const seed of SEEDS) {
      expect(baseline(seed).pmToCompanyMin).toBeGreaterThanOrEqual(4.5);
      expect(baseline(seed).pmToCompanyMin).toBeLessThanOrEqual(6.5);
    }
  });

  it('freeze-features, when a run offers it, waits at least 60 s after Evaluations', () => {
    const delays = [...SEEDS, 101].map(
      (seed) =>
        (seed === 101 ? measured('baseline-101', () => measureRun(101)) : baseline(seed))
          .freezeDelaySec,
    );
    expect(delays.some((d) => d !== null)).toBe(true);
    for (const delay of delays) if (delay !== null) expect(delay).toBeGreaterThanOrEqual(60);
  });

  it('five lessons learned (experience 0.5) still leave 60 % of the run', () => {
    for (const seed of SEEDS) {
      const m = measured(`xp-${seed}`, () => measureRun(seed, { experience: 0.5 }));
      expect(minutes(m)).toBeGreaterThanOrEqual(0.6 * minutes(baseline(seed)));
    }
  });

  it('a player who picks the next build within a second loses ≤ 3 % of code to drifting', () => {
    for (const seed of SEEDS) expect(baseline(seed).taxedShareEarly).toBeLessThanOrEqual(0.03);
  });

  it('a player who takes 15 s to pick loses 10–30 % before Manager Agent, ≤ 25 % of the run', () => {
    const slow = measured('react-15', () => measureRun(1, { react: 15 }));
    expect(slow.taxedShareEarly).toBeGreaterThanOrEqual(0.1);
    expect(slow.taxedShareEarly).toBeLessThanOrEqual(0.3);
    expect(minutes(slow)).toBeLessThanOrEqual(1.25 * minutes(baseline(1)));
  });

  it.todo('mashing at 10 cps is at most 10 % faster (measured 14–16 %)');
  it.todo('acts 2 and 5 end near 7 / 20 (measured 6.8–6.9 / 19.8–20.6)');
  it.todo(
    'coordination hurts (< 0.95) for 20–50 % of minutes 16–31 (measured 3–5 %: the second worktree builds the capacity that relieves it)',
  );
  it.todo('quality < 0.9 for 30–60 % of minutes 16–31 (measured 21–31 %)');
  it.todo('two optional cards visible ≥ 80 % of the time from 4 min (D29: only helpful capacity)');
  it.todo('act walls ≥ 2 min (measured 1.2–2.6)');
  it.todo('the seer buyer peaks at ≤ 120 debt (measured 37–328)');
  it.todo('an auto-refill v1 disaster costs 25–40 s of progress (measured 4–74 s)');
});
