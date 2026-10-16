/**
 * The demo generator's own seeded randomness (mulberry32). Demos are presentation: the game
 * stores only a seed per demo, and everything here is derived from those seeds.
 */
export interface DemoRng {
  /** Float in [0, 1). */
  f(): number;
  range(min: number, max: number): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  sign(): 1 | -1;
}

export function demoRng(seed: number): DemoRng {
  let state = seed >>> 0;
  const f = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let r = Math.imul(state ^ (state >>> 15), state | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const rng: DemoRng = {
    f,
    range: (min, max) => min + (max - min) * f(),
    int: (min, max) => min + Math.floor(f() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(f() * items.length)];
      if (item === undefined) throw new Error('pick from an empty list');
      return item;
    },
    chance: (p) => f() < p,
    sign: () => (f() < 0.5 ? 1 : -1),
  };
  return rng;
}

/** A child seed for a numbered sub-stream, so one demo seed feeds several independent draws. */
export function subSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
