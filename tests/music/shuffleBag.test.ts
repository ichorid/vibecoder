import { describe, expect, it } from 'vitest';
import { createBag, nextFromBag, type BagState } from '../../src/music/core/shuffleBag';

function draw(state: BagState, keys: readonly string[], count: number) {
  const out: (string | null)[] = [];
  let current = state;
  for (let i = 0; i < count; i += 1) {
    const result = nextFromBag(
      current,
      keys.map((key) => ({ key, weight: 1 })),
    );
    out.push(result.key);
    current = result.state;
  }
  return { out, state: current };
}

describe('shuffle-bag', () => {
  const keys = ['a@1', 'b@1', 'c@1', 'd@1'];

  it('plays every candidate exactly once per bag', () => {
    const { out } = draw(createBag(7), keys, 12);
    for (let bag = 0; bag < 3; bag += 1) {
      expect([...out.slice(bag * 4, bag * 4 + 4)].sort()).toEqual(keys);
    }
  });

  it('never repeats across a bag boundary when there are at least two candidates', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const { out } = draw(createBag(seed), ['x@1', 'y@1'], 40);
      for (let i = 1; i < out.length; i += 1) expect(out[i]).not.toBe(out[i - 1]);
    }
  });

  it('is reproducible from its seed and serializable', () => {
    const a = draw(createBag(99), keys, 9);
    const b = draw(createBag(99), keys, 9);
    expect(a.out).toEqual(b.out);
    const restored = JSON.parse(JSON.stringify(a.state)) as BagState;
    expect(draw(restored, keys, 6).out).toEqual(draw(a.state, keys, 6).out);
    expect(draw(createBag(100), keys, 9).out).not.toEqual(a.out);
  });

  it('repeats a single candidate without looping forever, and reports empty banks', () => {
    expect(draw(createBag(1), ['solo@1'], 3).out).toEqual(['solo@1', 'solo@1', 'solo@1']);
    const empty = nextFromBag(createBag(1), []);
    expect(empty.key).toBeNull();
    expect(empty.status).toBe('unavailable');
  });

  it('rebuilds when candidates change and never serves a removed version', () => {
    const first = draw(createBag(3), keys, 1);
    const remaining = keys.filter((k) => k !== 'b@1' && k !== first.out[0]);
    const later = draw(
      first.state,
      keys.filter((k) => k !== 'b@1'),
      6,
    );
    expect(later.out).not.toContain('b@1');
    expect(remaining.length).toBeGreaterThan(0);
  });
});
