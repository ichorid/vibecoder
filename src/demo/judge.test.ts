import { describe, expect, it } from 'vitest';
import { randomGenome, type Genome } from './genome';
import {
  candidates,
  change,
  firstDemo,
  genomeOf,
  judge,
  lineage,
  finish,
  MASK_H,
  MASK_W,
  symmetryOf,
  MIN_CHANGE,
  MYSTERY,
  mysteryDemo,
  nextDemo,
  nextVariants,
  pickScore,
  VARIANTS,
} from './judge';

describe('the demo judge', () => {
  it('almost every seed yields a viable first demo without the fallback', () => {
    let viable = 0;
    for (let seed = 1; seed <= 40; seed++) if (firstDemo(seed * 31).verdict.ok) viable++;
    expect(viable).toBeGreaterThanOrEqual(38);
  });

  it('a lone ball is not a demo', () => {
    const g: Genome = { ...randomGenome(1), copies: 1, mirror: false };
    g.root = { ...g.root, ribs: 0, child: { prim: 'ball', tone: 0 }, bulb: null };
    expect(judge(g).ok).toBe(false);
  });

  it('children are viable, visibly different and not only recoloured', () => {
    const parent = firstDemo(77);
    const kids = candidates(parent, 1234);
    expect(kids.length).toBeGreaterThan(0);
    for (const kid of kids) {
      expect(kid.verdict.ok).toBe(true);
      expect(kid.change).toBeGreaterThanOrEqual(MIN_CHANGE);
      expect(kid.ops.some((op) => !['palette', 'style', 'backdrop', 'trails'].includes(op))).toBe(
        true,
      );
    }
    const next = nextDemo(parent, 1234);
    const best = kids.reduce((a, b) => (pickScore(parent, b) > pickScore(parent, a) ? b : a));
    expect(next.verdict).toEqual(best.verdict);
    expect(change(parent.verdict, next.verdict)).toBeGreaterThanOrEqual(MIN_CHANGE);
  });

  it('a lineage is reproducible from its steps and replays one demo per step', () => {
    const steps = [101, 202, 303, 404].map((seed) => ({ seed, pick: null }));
    const progress = [
      ...(function* () {
        const it = lineage(steps);
        for (let r = it.next(); !r.done; r = it.next()) yield r.value;
      })(),
    ];
    expect(progress).toEqual([0.25, 0.5, 0.75, 1]);
    expect(genomeOf(steps)).toEqual(genomeOf(steps.map((s) => ({ ...s }))));
    // cached: a replay does no work
    expect(lineage(steps).next().done).toBe(true);
    expect(JSON.stringify(genomeOf(steps))).not.toBe(JSON.stringify(genomeOf(steps.slice(0, 3))));
  });

  it('the next demo offers three different variants; a pick builds exactly that one', () => {
    const steps = [{ seed: 11, pick: null }];
    const options = finish(nextVariants(steps, 22));
    expect(options).toHaveLength(VARIANTS);
    for (let i = 0; i < options.length; i++)
      for (let j = i + 1; j < options.length; j++) {
        const a = options[i],
          b = options[j];
        if (a && b) expect(change(a.verdict, b.verdict)).toBeGreaterThan(0.1);
      }
    // the judge's own pick is the first variant
    expect(genomeOf([...steps, { seed: 22, pick: null }])).toEqual(options[0]?.genome);
    expect(genomeOf([...steps, { seed: 22, pick: 2 }])).toEqual(options[2]?.genome);
    // the mystery is a brand-new form
    expect(genomeOf([...steps, { seed: 22, pick: MYSTERY }])).toEqual(mysteryDemo(22).genome);
    // and the very first demo has variants too
    const first = finish(nextVariants([], 7));
    expect(new Set(first.map((v) => JSON.stringify(v.genome))).size).toBe(3);
    expect(genomeOf([{ seed: 7, pick: 1 }])).toEqual(first[1]?.genome);
  });

  it('symmetry: radial pictures read high, and children pay a mild penalty for it', () => {
    // a ring of eight dots versus one off-centre blob
    const ring = new Uint8Array(MASK_W * MASK_H);
    const blob = new Uint8Array(MASK_W * MASK_H);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * 2 * Math.PI;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const x = Math.round(40 + 18 * Math.cos(a)) + dx,
            y = Math.round(25 + 18 * Math.sin(a)) + dy;
          ring[y * MASK_W + x] = 1;
        }
    }
    // a long thin bar: it only matches itself turned by 180°, which k ≥ 3 never tries
    for (let y = 23; y < 27; y++) for (let x = 10; x < 70; x++) blob[y * MASK_W + x] = 1;
    expect(symmetryOf(ring)).toBeGreaterThan(0.8);
    expect(symmetryOf(blob)).toBeLessThan(0.3);
    // same score, more symmetry: ranked lower — but only above the free level
    const parent = firstDemo(5);
    const withSymmetry = (symmetry: number) => ({
      ...parent,
      verdict: { ...parent.verdict, parts: { ...parent.verdict.parts, symmetry } },
    });
    expect(pickScore(parent, withSymmetry(0.9))).toBeLessThan(pickScore(parent, withSymmetry(0.6)));
    expect(pickScore(parent, withSymmetry(0.3))).toBe(pickScore(parent, withSymmetry(0.45)));
    expect(pickScore(parent, withSymmetry(0.6)) - pickScore(parent, withSymmetry(1))).toBeLessThan(
      0.5,
    );
  });
});
