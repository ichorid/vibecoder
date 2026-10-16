/**
 * Camera and framing shared by the judge and the rasterizer: the form is centred and scaled so
 * it fits the 160×100 screen for the whole demo, and rib size is chosen so neighbours touch.
 */
import type { Genome } from './genome';
import { expand, type Instances } from './horn';

export const SCREEN_W = 160;
export const SCREEN_H = 100;
/** Seconds sampled to find the form's extent (the motion is bounded and slow). */
const FRAMING_TIMES = [0, 4, 8, 12];

export interface Framing {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  /** Radius of the rib centres around the centre. */
  readonly r: number;
  /** World radius of a ball of scale 1. */
  readonly size: number;
  /** The biggest ball's radius over the form's radius (huge bulbs make poor demos). */
  readonly biggest: number;
}

export function framing(g: Genome, inst: Instances): Framing {
  let lx = Infinity,
    ly = Infinity,
    lz = Infinity,
    hx = -Infinity,
    hy = -Infinity,
    hz = -Infinity;
  const samples: Float32Array[] = [];
  let first: { x: Float32Array; y: Float32Array; z: Float32Array; s: Float32Array } | null = null;
  for (const t of FRAMING_TIMES) {
    const n = expand(g, t, inst);
    const xyz = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = inst.x[i] ?? 0,
        y = inst.y[i] ?? 0,
        z = inst.z[i] ?? 0;
      xyz[i * 3] = x;
      xyz[i * 3 + 1] = y;
      xyz[i * 3 + 2] = z;
      if (x < lx) lx = x;
      if (x > hx) hx = x;
      if (y < ly) ly = y;
      if (y > hy) hy = y;
      if (z < lz) lz = z;
      if (z > hz) hz = z;
    }
    samples.push(xyz);
    if (!first) {
      first = {
        x: inst.x.slice(0, n),
        y: inst.y.slice(0, n),
        z: inst.z.slice(0, n),
        s: inst.s.slice(0, n),
      };
    }
  }
  if (!Number.isFinite(lx)) return { cx: 0, cy: 0, cz: 0, r: 1, size: 0.05, biggest: 0.05 };
  const cx = (lx + hx) / 2,
    cy = (ly + hy) / 2,
    cz = (lz + hz) / 2;
  let r = 1e-6;
  for (const xyz of samples) {
    for (let i = 0; i < xyz.length; i += 3) {
      r = Math.max(
        r,
        Math.hypot((xyz[i] ?? 0) - cx, (xyz[i + 1] ?? 0) - cy, (xyz[i + 2] ?? 0) - cz),
      );
    }
  }
  // Rib size: the median gap between consecutive ribs, per unit of rib scale.
  const ratios: number[] = [];
  if (first) {
    for (let i = 1; i < first.x.length; i++) {
      const s = ((first.s[i] ?? 0) + (first.s[i - 1] ?? 0)) / 2;
      if (s <= 1e-6) continue;
      const d = Math.hypot(
        (first.x[i] ?? 0) - (first.x[i - 1] ?? 0),
        (first.y[i] ?? 0) - (first.y[i - 1] ?? 0),
        (first.z[i] ?? 0) - (first.z[i - 1] ?? 0),
      );
      ratios.push(d / s);
    }
  }
  ratios.sort((a, b) => a - b);
  const median = ratios[ratios.length >> 1] ?? 0.1;
  const size = Math.max(r * 0.02, Math.min(r * 0.2, median * 1.1));
  const maxScale = first ? first.s.reduce((m, v) => Math.max(m, v), 0) : 1;
  return { cx, cy, cz, r, size, biggest: (size * maxScale) / r };
}

/** Projected ribs: screen x, y, depth z (camera at 0, form centre at 3) and pixel radius. */
export interface Projected {
  readonly data: Float32Array;
  count: number;
  zmin: number;
  zmax: number;
}

export function createProjected(capacity: number): Projected {
  return { data: new Float32Array(capacity * 4), count: 0, zmin: 3, zmax: 3 };
}

export function project(inst: Instances, fr: Framing, out: Projected, scale = 1): Projected {
  const k = 1.3 / (fr.r + fr.size);
  let zmin = Infinity,
    zmax = -Infinity;
  const n = Math.min(inst.count, out.data.length / 4);
  for (let i = 0; i < n; i++) {
    const z = ((inst.z[i] ?? 0) - fr.cz) * k + 3;
    const o = i * 4;
    out.data[o] = (SCREEN_W / 2 + ((((inst.x[i] ?? 0) - fr.cx) * k) / z) * SCREEN_H) * scale;
    out.data[o + 1] = (SCREEN_H / 2 - ((((inst.y[i] ?? 0) - fr.cy) * k) / z) * SCREEN_H) * scale;
    out.data[o + 2] = z;
    out.data[o + 3] = ((fr.size * (inst.s[i] ?? 0) * k) / z) * SCREEN_H * scale;
    if (z < zmin) zmin = z;
    if (z > zmax) zmax = z;
  }
  out.count = n;
  out.zmin = Number.isFinite(zmin) ? zmin : 3;
  out.zmax = Number.isFinite(zmax) ? zmax : 3;
  return out;
}
