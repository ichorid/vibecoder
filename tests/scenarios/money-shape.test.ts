import { describe, expect, it } from 'vitest';
import { measureRun, type RunMetrics } from '../helpers/metrics';

/**
 * The money contract (docs/feature_money.md §9): rent and the landlord are pressure, never a
 * coin flip for a sensible player; ignoring money is fatal; the enterprise job is safe while it
 * lasts and builds nothing. Same harness as tools/tune.ts.
 */
const SEEDS = [1, 7, 42, 101, 2024] as const;
const cache = new Map<string, RunMetrics>();
function measured(key: string, run: () => RunMetrics): RunMetrics {
  const hit = cache.get(key);
  if (hit) return hit;
  const m = run();
  cache.set(key, m);
  return m;
}

describe('money shape (§9 contract)', { timeout: 300_000 }, () => {
  it('a freelancer who takes a gig below 1.5 rents never misses a month', () => {
    for (const seed of [1, 42] as const) {
      const m = measured(`freelancer-${seed}`, () => measureRun(seed));
      expect(m.rentMissed, `seed ${seed}`).toBe(0);
      expect(m.gigsPaid, `seed ${seed}`).toBeGreaterThan(5);
    }
  });

  it('a careless player (gigs only once in debt) is evicted in most runs', () => {
    const evicted = SEEDS.map((seed) =>
      measured(`careless-${seed}`, () => measureRun(seed, { freelance: -1 })),
    ).filter((m) => m.evictedMin !== null);
    expect(evicted.length).toBeGreaterThanOrEqual(3);
    for (const m of evicted) expect(m.evictedMin).toBeLessThanOrEqual(30);
  });

  it('a player who ignores money is evicted in every run, after a few months of luck', () => {
    for (const seed of SEEDS) {
      const m = measured(`ignore-${seed}`, () => measureRun(seed, { freelance: 0 }));
      expect(m.evictedMin, `seed ${seed}`).not.toBeNull();
      expect(m.evictedMin ?? 0).toBeGreaterThanOrEqual(8);
      expect(m.evictedMin ?? Infinity).toBeLessThanOrEqual(30);
      expect(m.run.ending?.id).toBe('ai-got-my-job');
    }
  });

  it('gigs take a real share of the code while money matters, and fade once the company pays', () => {
    const m = measured('freelancer-1', () => measureRun(1));
    const [, two, three, , five] = m.gigShareByAct;
    expect(two).toBeGreaterThan(0.1);
    expect(three).toBeGreaterThan(0.05);
    expect(five).toBeLessThan(0.1);
  });

  it('the frugal lesson (rent −10 %) keeps the run in shape', () => {
    const m = measured('frugal-1', () => measureRun(1, { frugal: 0.9 }));
    expect(m.rentMissed).toBeLessThanOrEqual(1);
    expect(m.evictedMin).toBeNull();
    expect(m.companyMin).not.toBeNull();
  });
});
