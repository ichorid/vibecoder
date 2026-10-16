/**
 * The horn engine: transforms, the five rules and the expansion of a genome into rib
 * instances for one moment. Written for speed (docs/feature_demo.md §Speed):
 *
 * - a transform is 13 floats in a typed array (m0..m8 rotation, s scale, t0..t2 translation),
 *   row-vector convention p' = (p · M) · s + t, composed in place without allocation;
 * - each horn's rib transforms are computed ONCE per frame into a table, then only composed
 *   with each parent rib (an inner tendril is not re-evaluated for every rib of its parent);
 * - innermost ribs keep only centre and scale: a ball looks the same from every side.
 */
import { WAVE_PERIODS, type Genome, type Horn, type Param, type Rule } from './genome';

const DEG = Math.PI / 180;
const X = 13;
export const MAX_INSTANCES = 4096;

/** One frame's rib instances, in drawing-independent emission order. */
export interface Instances {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  /** |scale| of the rib (a ball's radius factor). */
  readonly s: Float32Array;
  /** Colour ramp 0–2. */
  readonly tone: Uint8Array;
  /** Consecutive ribs of one tube share a chain number (the wire style connects them). */
  readonly chain: Uint32Array;
  count: number;
}

export function createInstances(capacity = MAX_INSTANCES): Instances {
  return {
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    z: new Float32Array(capacity),
    s: new Float32Array(capacity),
    tone: new Uint8Array(capacity),
    chain: new Uint32Array(capacity),
    count: 0,
  };
}

export const value = (p: Param, w: ArrayLike<number>): number =>
  typeof p === 'number'
    ? p
    : p.base + p.amp * (w[p.osc] ?? 0) + (p.amp2 ? p.amp2 * (w[p.osc2 ?? 0] ?? 0) : 0);

export function setIdentity(o: Float32Array, k: number): void {
  o.fill(0, k, k + X);
  o[k] = 1;
  o[k + 4] = 1;
  o[k + 8] = 1;
  o[k + 9] = 1;
}

/** Rotation about X (0), Y (1) or Z (2) by `deg` degrees. */
export function setRotation(o: Float32Array, k: number, axis: 0 | 1 | 2, deg: number): void {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  setIdentity(o, k);
  if (axis === 0) {
    o[k + 4] = c;
    o[k + 5] = s;
    o[k + 7] = -s;
    o[k + 8] = c;
  } else if (axis === 1) {
    o[k] = c;
    o[k + 2] = -s;
    o[k + 6] = s;
    o[k + 8] = c;
  } else {
    o[k] = c;
    o[k + 1] = s;
    o[k + 3] = -s;
    o[k + 4] = c;
  }
}

/** o = a then b ("apply a, then b"); `o` may be `a` or `b`. */
export function compose(
  o: Float32Array,
  io: number,
  a: Float32Array,
  ia: number,
  b: Float32Array,
  ib: number,
): void {
  const a0 = a[ia] ?? 0,
    a1 = a[ia + 1] ?? 0,
    a2 = a[ia + 2] ?? 0;
  const a3 = a[ia + 3] ?? 0,
    a4 = a[ia + 4] ?? 0,
    a5 = a[ia + 5] ?? 0;
  const a6 = a[ia + 6] ?? 0,
    a7 = a[ia + 7] ?? 0,
    a8 = a[ia + 8] ?? 0;
  const as = a[ia + 9] ?? 0,
    t0 = a[ia + 10] ?? 0,
    t1 = a[ia + 11] ?? 0,
    t2 = a[ia + 12] ?? 0;
  const b0 = b[ib] ?? 0,
    b1 = b[ib + 1] ?? 0,
    b2 = b[ib + 2] ?? 0;
  const b3 = b[ib + 3] ?? 0,
    b4 = b[ib + 4] ?? 0,
    b5 = b[ib + 5] ?? 0;
  const b6 = b[ib + 6] ?? 0,
    b7 = b[ib + 7] ?? 0,
    b8 = b[ib + 8] ?? 0;
  const bs = b[ib + 9] ?? 0,
    u0 = b[ib + 10] ?? 0,
    u1 = b[ib + 11] ?? 0,
    u2 = b[ib + 12] ?? 0;
  o[io] = a0 * b0 + a1 * b3 + a2 * b6;
  o[io + 1] = a0 * b1 + a1 * b4 + a2 * b7;
  o[io + 2] = a0 * b2 + a1 * b5 + a2 * b8;
  o[io + 3] = a3 * b0 + a4 * b3 + a5 * b6;
  o[io + 4] = a3 * b1 + a4 * b4 + a5 * b7;
  o[io + 5] = a3 * b2 + a4 * b5 + a5 * b8;
  o[io + 6] = a6 * b0 + a7 * b3 + a8 * b6;
  o[io + 7] = a6 * b1 + a7 * b4 + a8 * b7;
  o[io + 8] = a6 * b2 + a7 * b5 + a8 * b8;
  o[io + 9] = as * bs;
  o[io + 10] = (t0 * b0 + t1 * b3 + t2 * b6) * bs + u0;
  o[io + 11] = (t0 * b1 + t1 * b4 + t2 * b7) * bs + u1;
  o[io + 12] = (t0 * b2 + t1 * b5 + t2 * b8) * bs + u2;
}

const tmp = new Float32Array(X * 4);

/** One rule at tube position u ∈ [0, 1] (the grammar's definitions). */
export function ruleAt(o: Float32Array, k: number, rule: Rule, u: number, w: ArrayLike<number>) {
  switch (rule.op) {
    case 'tilt':
      setRotation(o, k, 0, rule.deg);
      return;
    case 'stack': // move up by u·h
      setIdentity(o, k);
      o[k + 11] = u * value(rule.a, w);
      return;
    case 'bend': // rotate about Z by u·angle
      setRotation(o, k, 2, u * value(rule.a, w));
      return;
    case 'twist': {
      // rotate about Y by u·angle around the point x = −offset
      const off = value(rule.b, w);
      setRotation(o, k, 1, u * value(rule.a, w));
      o[k + 10] = off * (o[k] ?? 1) - off;
      o[k + 12] = off * (o[k + 2] ?? 0);
      return;
    }
    case 'grow': {
      // scale by g^u (a negative g keeps its sign)
      const g = value(rule.a, w);
      setIdentity(o, k);
      o[k + 9] = g < 0 ? -((-g) ** u) : g ** u;
      return;
    }
    case 'branch': {
      // tilt down a sphere cap of `a` degrees, turn round the golden angle (phyllotaxis)
      const uc = u < 0 ? 0 : u > 1 ? 1 : u;
      const frac = Math.max(1e-4, (1 - Math.cos((value(rule.a, w) / 2) * DEG)) / 2);
      const c = Math.max(-1, Math.min(1, 0.99999 - uc * 1.99998 * frac));
      setRotation(tmp, X * 2, 0, Math.acos(c) / DEG);
      setRotation(tmp, X * 3, 1, rule.k * 137.5 * uc * rule.n);
      compose(o, k, tmp, X * 2, tmp, X * 3);
      return;
    }
  }
}

/** The transform of rib position `i` of a horn with `ribs` ribs: its rules, first to last. */
export function ribAt(
  o: Float32Array,
  k: number,
  h: Horn,
  i: number,
  ribs: number,
  w: ArrayLike<number>,
) {
  const first = h.rules[0];
  if (ribs === 0 || !first) {
    setIdentity(o, k);
    return;
  }
  const u = i / ribs;
  ruleAt(o, k, first, u, w);
  for (let q = 1; q < h.rules.length; q++) {
    const rule = h.rules[q];
    if (!rule) continue;
    ruleAt(tmp, X, rule, u, w);
    compose(o, k, o, k, tmp, X);
  }
}

interface Table {
  xf: Float32Array;
  /** Ribs drawn: the whole positions 0…⌈ribs⌉−1, then the (fractional) end at `ribs`. */
  n: number;
  tip: Float32Array;
}
const tables = new WeakMap<Horn, Table>();

function buildTables(h: Horn, w: ArrayLike<number>): void {
  const ribs = Math.max(0, value(h.ribs, w));
  const n = Math.ceil(ribs) + 1;
  let t = tables.get(h);
  if (!t || t.xf.length < n * X) {
    t = { xf: new Float32Array((n + 8) * X), n, tip: new Float32Array(X) };
    tables.set(h, t);
  }
  t.n = n;
  for (let j = 0; j < n - 1; j++) ribAt(t.xf, j * X, h, j, ribs, w);
  ribAt(t.xf, (n - 1) * X, h, ribs, ribs, w);
  if (h.bulb !== null) {
    t.tip.set(t.xf.subarray((n - 1) * X, n * X));
    t.tip[9] = (t.tip[9] ?? 1) * h.bulb;
  }
  if (h.child.prim !== 'ball') buildTables(h.child, w);
}

const scratch = Array.from({ length: 8 }, () => new Float32Array(X));
let chainSeq = 0;

function emit(out: Instances, p: Float32Array, tone: number): void {
  if (out.count >= out.x.length) return;
  const i = out.count++;
  out.x[i] = p[10] ?? 0;
  out.y[i] = p[11] ?? 0;
  out.z[i] = p[12] ?? 0;
  out.s[i] = Math.abs(p[9] ?? 0);
  out.tone[i] = tone;
  out.chain[i] = chainSeq;
}

function walk(h: Horn, parent: Float32Array, depth: number, tone: number, out: Instances): void {
  const t = tables.get(h);
  if (!t) return;
  const child = h.child;
  const xf = t.xf;
  if (child.prim === 'ball') {
    // leaf tube: centre and scale only
    chainSeq++;
    const p0 = parent[0] ?? 0,
      p1 = parent[1] ?? 0,
      p2 = parent[2] ?? 0;
    const p3 = parent[3] ?? 0,
      p4 = parent[4] ?? 0,
      p5 = parent[5] ?? 0;
    const p6 = parent[6] ?? 0,
      p7 = parent[7] ?? 0,
      p8 = parent[8] ?? 0;
    const ps = parent[9] ?? 0,
      q0 = parent[10] ?? 0,
      q1 = parent[11] ?? 0,
      q2 = parent[12] ?? 0;
    for (let j = 0; j < t.n; j++) {
      if (out.count >= out.x.length) return;
      const k = j * X;
      const a = xf[k + 10] ?? 0,
        b = xf[k + 11] ?? 0,
        c = xf[k + 12] ?? 0;
      const i = out.count++;
      out.x[i] = (a * p0 + b * p3 + c * p6) * ps + q0;
      out.y[i] = (a * p1 + b * p4 + c * p7) * ps + q1;
      out.z[i] = (a * p2 + b * p5 + c * p8) * ps + q2;
      out.s[i] = Math.abs((xf[k + 9] ?? 0) * ps);
      out.tone[i] = (tone + (h.alt && j % 2 === 1 && j < t.n - 1 ? 1 : 0) + child.tone) % 2;
      out.chain[i] = chainSeq;
    }
  } else {
    const o = scratch[depth] ?? new Float32Array(X);
    for (let j = 0; j < t.n; j++) {
      compose(o, 0, xf, j * X, parent, 0);
      walk(child, o, depth + 1, tone + (h.alt && j % 2 === 1 ? 1 : 0), out);
    }
  }
  if (h.bulb !== null) {
    const o = scratch[depth] ?? new Float32Array(X);
    compose(o, 0, t.tip, 0, parent, 0);
    chainSeq++;
    emit(out, o, 2);
  }
}

const base = new Float32Array(X * 3);
const waves = new Float64Array(WAVE_PERIODS.length);

/** The wave values of a genome at time t (seconds). */
export function wavesAt(g: Genome, t: number, w: Float64Array = waves): Float64Array {
  for (let i = 0; i < WAVE_PERIODS.length; i++) {
    w[i] = Math.sin((2 * Math.PI * t) / (WAVE_PERIODS[i] ?? 1) + (g.phase[i] ?? 0));
  }
  return w;
}

/** Fill `out` with the genome's ribs at time t; returns the count. */
export function expand(g: Genome, t: number, out: Instances): number {
  const w = wavesAt(g, t);
  buildTables(g.root, w);
  out.count = 0;
  chainSeq = 0;
  // pose: a slow tilt about X, then the spin about Y
  setRotation(base, 0, 0, g.tiltAmp * (w[g.tiltOsc] ?? 0) - 15);
  setRotation(base, X, 1, t * g.spin);
  compose(base, 0, base, 0, base, X);
  const copy = base.subarray(X, X * 2);
  for (let c = 0; c < g.copies; c++) {
    for (let m = 0; m < (g.mirror ? 2 : 1); m++) {
      if (m) setRotation(base, X, 0, 180);
      else setIdentity(base, X);
      setRotation(base, X * 2, 2, (360 * c) / g.copies);
      compose(base, X, base, X, base, X * 2);
      compose(base, X, base, X, base, 0); // mirror, then the copy's turn, then the pose
      walk(g.root, copy, 0, c % 2, out);
    }
  }
  return out.count;
}
