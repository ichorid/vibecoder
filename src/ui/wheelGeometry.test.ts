import { describe, expect, it } from 'vitest';
import {
  boundariesCrossed,
  CENTRE_BELOW_DEG,
  landingAngle,
  rotationAt,
  sliceArcs,
  spinRotation,
} from './wheelGeometry';

describe('release wheel geometry', () => {
  it('slices cover 360° and the gold slice is exactly hazard × 360°', () => {
    for (const hazard of [0.002, 0.0802, 0.13043]) {
      const arcs = sliceArcs(9, hazard);
      const total = arcs.reduce((sum, a) => sum + (a.end - a.start), 0);
      expect(total).toBeCloseTo(360, 9);
      const gold = arcs.at(-1);
      expect((gold?.end ?? 0) - (gold?.start ?? 0)).toBeCloseTo(hazard * 360, 9);
      const widths = arcs.slice(0, -1).map((a) => a.end - a.start);
      expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1e-9);
    }
  });

  it('lands inside the target slice, away from its edges; sub-6° slices land at the centre', () => {
    const arcs = sliceArcs(9, 0.0515);
    for (let seed = 0; seed < 200; seed += 1) {
      for (let target = 0; target < 9; target += 1) {
        const arc = arcs[target];
        if (!arc) throw new Error('no arc');
        const at = landingAngle(arcs, target, seed);
        const margin = (arc.end - arc.start) * 0.3 - 1e-9;
        expect(at).toBeGreaterThanOrEqual(arc.start + margin);
        expect(at).toBeLessThanOrEqual(arc.end - margin);
      }
    }
    const tiny = sliceArcs(9, 0.002);
    const gold = tiny[9];
    if (!gold) throw new Error('no gold slice');
    expect(gold.end - gold.start).toBeLessThan(CENTRE_BELOW_DEG);
    expect(landingAngle(tiny, 9, 42)).toBe((gold.start + gold.end) / 2);
  });

  it('spins 4–6 full turns and stops with the landing point under the pointer', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const landing = 123.4;
      const total = spinRotation(landing, seed);
      expect(total).toBeGreaterThanOrEqual(4 * 360);
      expect(total).toBeLessThan(7 * 360);
      expect((((landing + total) % 360) + 360) % 360).toBeCloseTo(0, 9);
      expect(rotationAt(total, 1)).toBe(total);
      expect(rotationAt(total, 0)).toBe(0);
    }
  });

  it('counts slice boundaries passing the pointer (one tick each)', () => {
    const arcs = sliceArcs(9, 0.1);
    expect(boundariesCrossed(arcs, 0, 360)).toBe(10);
    expect(boundariesCrossed(arcs, 0, 0)).toBe(0);
    expect(boundariesCrossed(arcs, 0, 720)).toBe(20);
  });
});
