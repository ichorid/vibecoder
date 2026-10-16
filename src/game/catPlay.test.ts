import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { mousePosition, sampleAttempt, scoreAttempt, triangleWave } from './catPlay';
import { createRng } from './random';

const play = catalog.balance.catPlay;

describe('mouse movement', () => {
  it('travels 0 → 1 → 0 and never leaves the track', () => {
    expect(triangleWave(0)).toBe(0);
    expect(triangleWave(0.5)).toBe(0.5);
    expect(triangleWave(1)).toBe(1);
    expect(triangleWave(1.5)).toBe(0.5);
    expect(triangleWave(2)).toBe(0);
    for (let x = 0; x < 20; x += 0.037) {
      expect(triangleWave(x)).toBeGreaterThanOrEqual(0);
      expect(triangleWave(x)).toBeLessThanOrEqual(1);
    }
  });

  it('gives one position for one timestamp', () => {
    expect(mousePosition(0.5, 1234)).toBe(mousePosition(0.5, 1234));
    expect(mousePosition(0.5, 1000)).toBeCloseTo(0.5, 9);
    expect(mousePosition(0.5, 3000)).toBeCloseTo(0.5, 9);
  });
});

describe('scoring', () => {
  const target = { start: 0.4, width: 0.2 };

  it.each([
    [0.4, 'hit'],
    [0.6, 'hit'],
    [0.5, 'hit'],
    [0.37, 'near'],
    [0.63, 'near'],
    [0.369, 'miss'],
    [0.631, 'miss'],
    [0, 'miss'],
  ] as const)('position %f is a %s', (position, outcome) => {
    expect(scoreAttempt(position, target, play.nearMissDistance)).toBe(outcome);
  });
});

describe('attempt sampling', () => {
  it('keeps targets 15–30% wide and inside the track, with bounded fair speed', () => {
    let rng = createRng(77);
    for (let i = 0; i < 500; i += 1) {
      const sample = sampleAttempt(rng, play);
      rng = sample.rng;
      const { target, speed } = sample.attempt;
      expect(target.width).toBeGreaterThanOrEqual(0.15);
      expect(target.width).toBeLessThanOrEqual(0.3);
      expect(target.start).toBeGreaterThanOrEqual(0);
      expect(target.start + target.width).toBeLessThanOrEqual(1 + 1e-12);
      expect(speed).toBeGreaterThanOrEqual(0.4);
      expect(speed).toBeLessThanOrEqual(0.75);
      // One crossing of the target must last at least the minimum hit window.
      expect((target.width / speed) * 1000).toBeGreaterThanOrEqual(play.minHitWindowMs - 1e-9);
    }
  });

  it('samples new parameters for each attempt', () => {
    const first = sampleAttempt(createRng(5), play);
    const second = sampleAttempt(first.rng, play);
    expect(second.rng).not.toBe(first.rng);
    expect(second.attempt).not.toEqual(first.attempt);
  });
});
