import { describe, expect, it } from 'vitest';
import { randomGenome, type Genome } from './genome';
import {
  candidates,
  change,
  firstDemo,
  genomeOf,
  judge,
  lineage,
  MIN_CHANGE,
  nextDemo,
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
    expect(next.verdict.score).toBe(Math.max(...kids.map((k) => k.verdict.score)));
    expect(change(parent.verdict, next.verdict)).toBeGreaterThanOrEqual(MIN_CHANGE);
  });

  it('a lineage is reproducible from its seeds and replays step by step', () => {
    const seeds = [101, 202, 303, 404];
    const steps = [
      ...(function* () {
        const it = lineage(seeds);
        for (let r = it.next(); !r.done; r = it.next()) yield r.value;
      })(),
    ];
    expect(steps).toEqual([0.25, 0.5, 0.75, 1]);
    expect(genomeOf(seeds)).toEqual(genomeOf([...seeds]));
    // cached: a replay does no work
    const again = lineage(seeds);
    expect(again.next().done).toBe(true);
    // a longer lineage starts with the same demos
    expect(JSON.stringify(genomeOf(seeds))).not.toBe(JSON.stringify(genomeOf(seeds.slice(0, 3))));
  });
});
