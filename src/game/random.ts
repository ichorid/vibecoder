/**
 * Small seeded PRNG (mulberry32). The whole generator state is one uint32 number, so it can be
 * persisted in the run and continues the same sequence after a JSON roundtrip.
 */
export interface Draw {
  readonly value: number;
  readonly state: number;
}

export function createRng(seed: number): number {
  return seed >>> 0;
}

/** FNV-1a mix of a run seed and a stream label: independent streams share one run seed. */
export function deriveSeed(seed: number, stream: string): number {
  let hash = (2166136261 ^ (seed >>> 0)) >>> 0;
  for (let i = 0; i < stream.length; i += 1) {
    hash ^= stream.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function nextUint32(state: number): Draw {
  const next = (state + 0x6d2b79f5) >>> 0;
  let r = Math.imul(next ^ (next >>> 15), next | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return { value: (r ^ (r >>> 14)) >>> 0, state: next };
}

/** Float in [0, 1). */
export function nextFloat(state: number): Draw {
  const draw = nextUint32(state);
  return { value: draw.value / 4294967296, state: draw.state };
}

/** Integer in [min, max], both bounds inclusive. */
export function nextInt(state: number, min: number, max: number): Draw {
  const draw = nextFloat(state);
  return { value: min + Math.floor(draw.value * (max - min + 1)), state: draw.state };
}

/** Float in [min, max). */
export function nextRange(state: number, min: number, max: number): Draw {
  const draw = nextFloat(state);
  return { value: min + draw.value * (max - min), state: draw.state };
}
