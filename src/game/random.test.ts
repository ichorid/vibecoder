import { describe, expect, it } from 'vitest';
import { createRng, deriveSeed, nextFloat, nextInt } from './random';

function sequence(state: number, count: number): number[] {
  const values: number[] = [];
  let current = state;
  for (let i = 0; i < count; i += 1) {
    const draw = nextFloat(current);
    values.push(draw.value);
    current = draw.state;
  }
  return values;
}

describe('seeded random', () => {
  it('produces the same sequence for the same seed', () => {
    expect(sequence(createRng(42), 8)).toEqual(sequence(createRng(42), 8));
    expect(sequence(createRng(42), 8)).not.toEqual(sequence(createRng(43), 8));
  });

  it('continues the same sequence after a JSON roundtrip of its state', () => {
    let state = createRng(7);
    for (let i = 0; i < 5; i += 1) state = nextFloat(state).state;
    const restored = JSON.parse(JSON.stringify({ state })) as { state: number };
    expect(sequence(restored.state, 5)).toEqual(sequence(state, 5));
  });

  it('keeps floats in [0, 1)', () => {
    for (const value of sequence(createRng(99), 2000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('includes both inclusive integer bounds', () => {
    const seen = new Set<number>();
    let state = createRng(1234);
    for (let i = 0; i < 2000; i += 1) {
      const draw = nextInt(state, 18, 32);
      seen.add(draw.value);
      state = draw.state;
    }
    expect(Math.min(...seen)).toBe(18);
    expect(Math.max(...seen)).toBe(32);
    expect(seen.size).toBe(15);
  });

  it('derives independent stream seeds from one run seed', () => {
    expect(deriveSeed(5, 'cat')).not.toBe(deriveSeed(5, 'economy'));
    expect(deriveSeed(5, 'cat')).toBe(deriveSeed(5, 'cat'));
  });
});
