/**
 * The horn engine: transforms, the five rules and the expansion of a genome into rib
 * instances for one moment. Written for speed (docs/feature_demo.md §Speed):
 *
 * - a transform is 13 floats in a typed array (m0..m8 rotation, s scale, t0..t2 translation),
 *   row-vector convention p' = (p · M) · s + t, composed in place without allocation;
 * - each horn's rib transforms are computed ONCE per frame into a table, then only composed
 *   with each parent rib — except a horn whose waves ripple: its table depends on the parent
 *   rib and is rebuilt for each one;
 * - innermost ribs keep only centre and scale: a ball looks the same from every side.
 */
import {
  WAVE_PERIODS,
  type Ball,
  type Colour,
  type Genome,
  type Horn,
  type Param,
  type Rule,
} from './genome';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
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
  /** Light 0–1 (colour pulses darken balls in a travelling wave). */
  readonly glow: Float32Array;
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
    glow: new Float32Array(capacity),
    chain: new Uint32Array(capacity),
    count: 0,
  };
}

/** Waves at one moment; `up` is the parent rib's position 0…1 (for rippling waves). */
export interface WaveContext {
  readonly w: ArrayLike<number>;
  readonly t: number;
  readonly phase: readonly number[];
  up: number;
}

const waveAt = (ctx: WaveContext, osc: number, shift: number) =>
  shift === 0
    ? (ctx.w[osc] ?? 0)
    : Math.sin((TAU * ctx.t) / (WAVE_PERIODS[osc] ?? 1) + (ctx.phase[osc] ?? 0) + shift);

export function value(p: Param, ctx: WaveContext): number {
  if (typeof p === 'number') return p;
  const shift = p.ripple ? p.ripple * ctx.up : 0;
  let v = p.base + p.amp * waveAt(ctx, p.osc, shift);
  if (p.amp2 !== undefined && p.osc2 !== undefined) v += p.amp2 * waveAt(ctx, p.osc2, shift);
  return v;
}

/** A context for plain wave values (tests, the dev page). */
export const constantWaves = (w: ArrayLike<number>): WaveContext => ({
  w,
  t: 0,
  phase: [],
  up: 0,
});

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
export function ruleAt(o: Float32Array, k: number, rule: Rule, u: number, ctx: WaveContext) {
  switch (rule.op) {
    case 'tilt':
      setRotation(o, k, 0, rule.deg);
      return;
    case 'stack': // move up by u·h
      setIdentity(o, k);
      o[k + 11] = u * value(rule.a, ctx);
      return;
    case 'bend': // rotate about Z by u·angle
      setRotation(o, k, 2, u * value(rule.a, ctx));
      return;
    case 'twist': {
      // rotate about Y by u·angle around the point x = −offset
      const off = value(rule.b, ctx);
      setRotation(o, k, 1, u * value(rule.a, ctx));
      o[k + 10] = off * (o[k] ?? 1) - off;
      o[k + 12] = off * (o[k + 2] ?? 0);
      return;
    }
    case 'grow': {
      // scale by g^u (a negative g keeps its sign)
      const g = value(rule.a, ctx);
      setIdentity(o, k);
      o[k + 9] = g < 0 ? -((-g) ** u) : g ** u;
      return;
    }
    case 'branch': {
      // tilt down a sphere cap of `a` degrees, turn round the golden angle (phyllotaxis)
      const uc = u < 0 ? 0 : u > 1 ? 1 : u;
      const frac = Math.max(1e-4, (1 - Math.cos((value(rule.a, ctx) / 2) * DEG)) / 2);
      const c = Math.max(-1, Math.min(1, 0.99999 - uc * 1.99998 * frac));
      setRotation(tmp, X * 2, 0, Math.acos(c) / DEG);
      setRotation(tmp, X * 3, 1, rule.k * 137.5 * uc * rule.n);
      compose(o, k, tmp, X * 2, tmp, X * 3);
      return;
    }
  }
}

/** A strand's placement after its rules: back by `center` × its length, then turned about Z. */
export function layInto(o: Float32Array, k: number, h: Horn, ctx: WaveContext): void {
  if (!h.lay) return;
  const stack = h.rules.find((r) => r.op === 'stack');
  const length = stack && stack.op === 'stack' ? value(stack.a, ctx) : 1;
  setIdentity(tmp, X * 3);
  tmp[X * 3 + 11] = -h.lay.center * length;
  setRotation(tmp, X * 2, 2, h.lay.turn);
  compose(tmp, X * 3, tmp, X * 3, tmp, X * 2);
  compose(o, k, o, k, tmp, X * 3);
}

/** The transform of rib position `i` of a horn with `ribs` ribs: its rules, first to last. */
export function ribAt(
  o: Float32Array,
  k: number,
  h: Horn,
  i: number,
  ribs: number,
  ctx: WaveContext,
) {
  const first = h.rules[0];
  if (ribs === 0 || !first) setIdentity(o, k);
  else {
    const u = i / ribs;
    ruleAt(o, k, first, u, ctx);
    for (let q = 1; q < h.rules.length; q++) {
      const rule = h.rules[q];
      if (!rule) continue;
      ruleAt(tmp, X, rule, u, ctx);
      compose(o, k, o, k, tmp, X);
    }
  }
  layInto(o, k, h, ctx);
}

interface Table {
  xf: Float32Array;
  /** Ribs drawn: the whole positions 0…⌈ribs⌉−1, then the (fractional) end at `ribs`. */
  n: number;
  ribs: number;
  tip: Float32Array;
}
const tables = new WeakMap<Horn, Table>();
const rippling = new WeakMap<Horn, boolean>();

/** Whether a horn's waves depend on its parent rib (then its table is per parent rib). */
export function ripples(h: Horn): boolean {
  let known = rippling.get(h);
  if (known === undefined) {
    const params: Param[] = [h.ribs];
    for (const rule of h.rules) {
      if (rule.op === 'tilt') continue;
      params.push(rule.a);
      if (rule.op === 'twist') params.push(rule.b);
    }
    known = params.some((p) => typeof p === 'object' && Boolean(p.ripple));
    rippling.set(h, known);
  }
  return known;
}

function buildTable(h: Horn, ctx: WaveContext): Table {
  const ribs = Math.max(0, value(h.ribs, ctx));
  const n = Math.ceil(ribs) + 1;
  let t = tables.get(h);
  if (!t || t.xf.length < n * X) {
    t = { xf: new Float32Array((n + 8) * X), n, ribs, tip: new Float32Array(X) };
    tables.set(h, t);
  }
  t.n = n;
  t.ribs = ribs;
  for (let j = 0; j < n - 1; j++) ribAt(t.xf, j * X, h, j, ribs, ctx);
  ribAt(t.xf, (n - 1) * X, h, ribs, ribs, ctx);
  if (h.bulb !== null) {
    t.tip.set(t.xf.subarray((n - 1) * X, n * X));
    t.tip[9] = (t.tip[9] ?? 1) * h.bulb;
  }
  return t;
}

/** Tables that do not depend on the parent rib, once per frame. */
function prepare(h: Horn, ctx: WaveContext): void {
  if (!ripples(h)) {
    ctx.up = 0;
    buildTable(h, ctx);
  }
  if (h.child.prim !== 'ball') prepare(h.child, ctx);
}

const scratch = Array.from({ length: 8 }, () => new Float32Array(X));
let chainSeq = 0;

interface Paint {
  readonly colour: Colour;
  readonly t: number;
  readonly copy: number;
}

function emit(out: Instances, p: Float32Array, tone: number, glow: number): void {
  if (out.count >= out.x.length) return;
  const i = out.count++;
  out.x[i] = p[10] ?? 0;
  out.y[i] = p[11] ?? 0;
  out.z[i] = p[12] ?? 0;
  out.s[i] = Math.abs(p[9] ?? 0);
  out.tone[i] = tone;
  out.glow[i] = glow;
  out.chain[i] = chainSeq;
}

const fract = (x: number) => x - Math.floor(x);

/** The colour ramp of rib `j` (position u) of a tube, by the genome's colour genes. */
function rampOf(
  h: Horn,
  child: Ball,
  j: number,
  last: boolean,
  u: number,
  travel: number,
  tone: number,
  index: number,
  paint: Paint,
): number {
  const { colour } = paint;
  const pattern = colour.pattern;
  const n = Math.max(1, pattern.length);
  switch (colour.mode) {
    case 'mono':
      return child.tone;
    case 'bands':
      return pattern[Math.floor(u * colour.bands) % n] ?? 0;
    case 'flow':
      return pattern[Math.floor(fract((u * colour.bands + travel) / n) * n)] ?? 0;
    case 'tentacles':
      return pattern[(index + paint.copy) % n] ?? 0;
    default:
      return (tone + (h.alt && j % 2 === 1 && !last ? 1 : 0) + child.tone) % 2;
  }
}

function walk(
  h: Horn,
  parent: Float32Array,
  depth: number,
  tone: number,
  out: Instances,
  ctx: WaveContext,
  paint: Paint,
  up: number,
  index: number,
): void {
  if (ripples(h)) {
    ctx.up = up;
    buildTable(h, ctx);
  }
  const t = tables.get(h);
  if (!t) return;
  const child: Horn | Ball = h.child;
  const xf = t.xf;
  if (child.prim === 'ball') {
    // leaf tube: centre and scale only
    chainSeq++;
    const { colour } = paint;
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
    const travel = colour.ripple * up - colour.speed * paint.t;
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
      const u = t.ribs > 0 ? Math.min(j, t.ribs) / t.ribs : 0;
      out.tone[i] = rampOf(h, child, j, j === t.n - 1, u, travel, tone, index, paint);
      out.glow[i] =
        colour.pulse > 0
          ? 1 - colour.pulse * (0.5 + 0.5 * Math.sin(TAU * 0.5 * (u * colour.bands + travel)))
          : 1;
      out.chain[i] = chainSeq;
    }
  } else {
    const o = scratch[depth] ?? new Float32Array(X);
    const span = Math.max(1, t.n - 1);
    for (let j = 0; j < t.n; j++) {
      compose(o, 0, xf, j * X, parent, 0);
      const toneJ = tone + (h.alt && j % 2 === 1 ? 1 : 0);
      walk(child, o, depth + 1, toneJ, out, ctx, paint, j / span, j);
    }
  }
  if (h.bulb !== null) {
    // the tip is in the horn's own frame: compose with the parent
    const o = scratch[depth] ?? new Float32Array(X);
    compose(o, 0, t.tip, 0, parent, 0);
    chainSeq++;
    emit(out, o, 2, 1);
  }
}

const base = new Float32Array(X * 3);
const waves = new Float64Array(WAVE_PERIODS.length);

/** The wave values of a genome at time t (seconds). */
export function wavesAt(g: Genome, t: number, w: Float64Array = waves): Float64Array {
  for (let i = 0; i < WAVE_PERIODS.length; i++) {
    w[i] = Math.sin((TAU * t) / (WAVE_PERIODS[i] ?? 1) + (g.phase[i] ?? 0));
  }
  return w;
}

/** The pose at time t into `o` (13 floats at `k`); exported for the reference test. */
export function poseAt(o: Float32Array, k: number, g: Genome, w: ArrayLike<number>, t: number) {
  const tilt = g.tiltAmp * (w[g.tiltOsc] ?? 0);
  const turn = g.spinAmp * (w[g.spinOsc] ?? 0) + g.drift * t;
  if (g.view === 'vortex') {
    // the form's axis points at the camera; it rolls in the picture plane
    setRotation(o, k, 0, -90 + tilt * 0.4);
    setRotation(tmp, X * 2, 2, turn);
  } else {
    // it sways in front of the camera
    setRotation(o, k, 0, tilt - 15);
    setRotation(tmp, X * 2, 1, turn);
  }
  compose(o, k, o, k, tmp, X * 2);
}

/** Fill `out` with the genome's ribs at time t; returns the count. */
export function expand(g: Genome, t: number, out: Instances): number {
  const w = wavesAt(g, t);
  const ctx: WaveContext = { w, t, phase: g.phase, up: 0 };
  prepare(g.root, ctx);
  out.count = 0;
  chainSeq = 0;
  poseAt(base, 0, g, w, t);
  const copy = base.subarray(X, X * 2);
  for (let c = 0; c < g.copies; c++) {
    for (let m = 0; m < (g.mirror ? 2 : 1); m++) {
      if (m) setRotation(base, X, 0, 180);
      else setIdentity(base, X);
      setRotation(base, X * 2, 2, (360 * c) / g.copies);
      compose(base, X, base, X, base, X * 2);
      compose(base, X, base, X, base, 0); // mirror, then the copy's turn, then the pose
      walk(g.root, copy, 0, c % 2, out, ctx, { colour: g.colour, t, copy: c }, 0, c);
    }
  }
  return out.count;
}
