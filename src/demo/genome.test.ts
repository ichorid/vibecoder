import { describe, expect, it } from 'vitest';
import {
  BUDGET,
  cloneGenome,
  instanceBound,
  mutate,
  randomGenome,
  structureOk,
  TENDRILS,
  type Genome,
} from './genome';
import { createInstances, expand } from './horn';

describe('demo genomes', () => {
  it('a seed always gives the same genome; different seeds differ', () => {
    expect(randomGenome(42)).toEqual(randomGenome(42));
    expect(JSON.stringify(randomGenome(42))).not.toBe(JSON.stringify(randomGenome(43)));
  });

  it('every family can be drawn', () => {
    for (const family of TENDRILS) expect(randomGenome(7, family).root.kind).toBe(family);
  });

  it('random genomes and long mutation lineages keep the house rules and the budget', () => {
    const inst = createInstances();
    for (let seed = 1; seed <= 200; seed++) {
      let g: Genome = randomGenome(seed);
      for (let step = 0; step <= 6; step++) {
        expect(structureOk(g)).toBe(true);
        expect(instanceBound(g)).toBeLessThanOrEqual(BUDGET);
        // the bound really bounds what a frame draws
        for (const t of [0, 5]) expect(expand(g, t, inst)).toBeLessThanOrEqual(instanceBound(g));
        g = mutate(g, seed * 100 + step)?.genome ?? g;
      }
    }
  });

  it('house rules: stack and tilt only open a horn; bend and twist never touch', () => {
    const g = randomGenome(3, 'taper');
    const withRules = (rules: Genome['root']['rules']) => ({ ...g, root: { ...g.root, rules } });
    expect(
      structureOk(
        withRules([
          { op: 'stack', a: 1 },
          { op: 'grow', a: 0.5 },
        ]),
      ),
    ).toBe(true);
    expect(
      structureOk(
        withRules([
          { op: 'grow', a: 0.5 },
          { op: 'stack', a: 1 },
        ]),
      ),
    ).toBe(false);
    expect(
      structureOk(
        withRules([
          { op: 'stack', a: 1 },
          { op: 'tilt', deg: 30 },
        ]),
      ),
    ).toBe(false);
    expect(
      structureOk(
        withRules([
          { op: 'stack', a: 1 },
          { op: 'bend', a: 30 },
          { op: 'twist', a: 90, b: 0 },
        ]),
      ),
    ).toBe(false);
    expect(
      structureOk(
        withRules([
          { op: 'stack', a: 1 },
          { op: 'twist', a: 90, b: 0 },
          { op: 'bend', a: 30 },
        ]),
      ),
    ).toBe(false);
  });

  it('mutation is deterministic, works on a copy, and survives JSON', () => {
    const parent = randomGenome(9);
    const before = JSON.stringify(parent);
    const a = mutate(parent, 5);
    expect(a).toEqual(mutate(parent, 5));
    expect(JSON.stringify(parent)).toBe(before);
    expect(a && JSON.parse(JSON.stringify(a.genome))).toEqual(a?.genome);
    expect(cloneGenome(parent)).toEqual(parent);
  });
});
