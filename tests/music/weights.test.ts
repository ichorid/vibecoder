import { describe, expect, it } from 'vitest';
import { checkBankCompatibility } from '../../src/music/core/compatibility';
import {
  createBag,
  nextFromBag,
  validWeight,
  type BagState,
} from '../../src/music/core/shuffleBag';
import type { NormalizedPattern } from '../../src/music/core/validation';

function sequence(weights: Record<string, number>, count: number, seed = 5) {
  let state: BagState = createBag(seed);
  const out: string[] = [];
  const candidates = Object.entries(weights).map(([key, weight]) => ({ key, weight }));
  for (let i = 0; i < count; i += 1) {
    const r = nextFromBag(state, candidates);
    if (r.key) out.push(r.key);
    state = r.state;
  }
  return out;
}

describe('weights', () => {
  it('orders the bag but never adds duplicates', () => {
    const out = sequence({ 'a@1': 10, 'b@1': 1, 'c@1': 1 }, 3);
    expect([...out].sort()).toEqual(['a@1', 'b@1', 'c@1']);
  });

  it('puts heavier candidates earlier more often', () => {
    let first = 0;
    for (let seed = 1; seed <= 200; seed += 1)
      if (sequence({ 'a@1': 20, 'b@1': 1, 'c@1': 1 }, 1, seed)[0] === 'a@1') first += 1;
    expect(first).toBeGreaterThan(140);
  });

  it('excludes weight 0 and rejects invalid weights', () => {
    expect(sequence({ 'a@1': 1, 'b@1': 0 }, 6)).not.toContain('b@1');
    expect(validWeight(-1)).toBe(false);
    expect(validWeight(Number.NaN)).toBe(false);
    expect(sequence({ 'a@1': -1, 'b@1': 1 }, 3)).toEqual(['b@1', 'b@1', 'b@1']);
  });

  it('is deterministic', () => {
    expect(sequence({ 'a@1': 3, 'b@1': 2, 'c@1': 1 }, 9)).toEqual(
      sequence({ 'a@1': 3, 'b@1': 2, 'c@1': 1 }, 9),
    );
  });
});

function normalized(id: string, overrides: Partial<NormalizedPattern> = {}): NormalizedPattern {
  return {
    id,
    revision: 1,
    eraId: 'discovery',
    bpm: 120,
    bars: 4,
    stepsPerBar: 16,
    timeSignature: { numerator: 4, denominator: 4 },
    totalSteps: 64,
    energy: 0.5,
    entryGroup: 'tonic',
    exitGroup: 'tonic',
    events: [],
    ...overrides,
  };
}

describe('bank compatibility', () => {
  it('accepts a bank sharing clock and boundary groups', () => {
    expect(
      checkBankCompatibility([normalized('a'), normalized('b')], { allowed: [['tonic', 'tonic']] }),
    ).toEqual([]);
  });

  it('rejects mismatched clocks and disallowed boundary pairs even in the same key', () => {
    const slow = normalized('slow', { bpm: 90 });
    expect(
      checkBankCompatibility([normalized('a'), slow], { allowed: [['tonic', 'tonic']] }).join(),
    ).toMatch(/clock/);
    const dominant = normalized('dom', { exitGroup: 'dominant' });
    const problems = checkBankCompatibility([normalized('a'), dominant], {
      allowed: [['tonic', 'tonic']],
    });
    expect(problems.join()).toMatch(/dom@1 → a@1|dom@1 → dom@1/);
    expect(
      checkBankCompatibility([normalized('a'), dominant], {
        allowed: [
          ['tonic', 'tonic'],
          ['dominant', 'tonic'],
        ],
      }),
    ).toEqual([]);
  });
});
