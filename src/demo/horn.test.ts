import { describe, expect, it } from 'vitest';
import {
  randomGenome,
  WAVE_PERIODS,
  type Ball,
  type Genome,
  type Horn,
  type Param,
  type Rule,
} from './genome';
import { compose, createInstances, expand, ruleAt, setRotation, value } from './horn';

const X = 13;
const point = (xf: Float32Array, p: readonly number[]) =>
  [0, 1, 2].map(
    (j) =>
      ((p[0] ?? 0) * (xf[j] ?? 0) +
        (p[1] ?? 0) * (xf[3 + j] ?? 0) +
        (p[2] ?? 0) * (xf[6 + j] ?? 0)) *
        (xf[9] ?? 0) +
      (xf[10 + j] ?? 0),
  );
const rule = (r: Rule, u: number) => {
  const o = new Float32Array(X);
  ruleAt(o, 0, r, u, [0, 0, 0, 0, 0, 0, 0]);
  return o;
};
const close = (a: readonly number[], b: readonly number[], digits = 5) =>
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i] ?? NaN, digits));

describe('transforms and rules (the horn grammar definitions)', () => {
  it('rotations use the row-vector convention and compose as "a then b"', () => {
    const z90 = new Float32Array(X);
    setRotation(z90, 0, 2, 90);
    close(point(z90, [1, 0, 0]), [0, 1, 0]);
    const x90 = new Float32Array(X);
    setRotation(x90, 0, 0, 90);
    const both = new Float32Array(X);
    compose(both, 0, z90, 0, x90, 0);
    // x → y under Z, then y → z under X
    close(point(both, [1, 0, 0]), [0, 0, 1]);
  });

  it('stack moves up by u·h; bend turns about Z by u·angle', () => {
    close(point(rule({ op: 'stack', a: 2 }, 0.25), [0, 0, 0]), [0, 0.5, 0]);
    close(point(rule({ op: 'bend', a: 180 }, 0.5), [1, 0, 0]), [0, 1, 0]);
  });

  it('twist turns about Y around the point x = −offset', () => {
    close(point(rule({ op: 'twist', a: 360, b: 0.5 }, 0.5), [0, 0, 0]), [-1, 0, 0]);
    close(point(rule({ op: 'twist', a: 360, b: 0 }, 0.5), [0, 0, 0]), [0, 0, 0]);
  });

  it('grow scales by g^u and keeps a negative sign', () => {
    expect(rule({ op: 'grow', a: 4 }, 0.5)[9]).toBeCloseTo(2);
    expect(rule({ op: 'grow', a: -4 }, 0.5)[9]).toBeCloseTo(-2);
  });

  it('branch spreads over the cap: no tilt at u = 0, the full cap at u = 1', () => {
    // the definition starts at acos(0.99999), a hair off the axis
    close(point(rule({ op: 'branch', a: 360, k: 1, n: 8 }, 0), [0, 1, 0]), [0, 1, 0], 2);
    close(
      point(rule({ op: 'branch', a: 360, k: 1, n: 8 }, 1), [0, 1, 0]).map((v) => Math.abs(v)),
      [0, 1, 0],
      2,
    );
    const half = point(rule({ op: 'branch', a: 180, k: 0, n: 8 }, 1), [0, 1, 0]);
    expect(half[1]).toBeCloseTo(0, 3); // a 180° cap ends on the equator
  });

  it('waves add to a base', () => {
    const p: Param = { base: 1, amp: 2, osc: 1, amp2: 1, osc2: 2 };
    expect(value(p, [0, 0.5, -1])).toBe(1);
  });
});

// ---- a deliberately naive reference: objects, recursion, every rule re-evaluated ----
type Ref = { m: number[]; s: number; t: number[] };
const refId = (): Ref => ({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], s: 1, t: [0, 0, 0] });
const fromArr = (a: Float32Array): Ref => ({
  m: [...a.slice(0, 9)],
  s: a[9] ?? 0,
  t: [...a.slice(10, 13)],
});
const then = (a: Ref, b: Ref): Ref => {
  const m = Array.from({ length: 9 }, (_, q) => {
    const i = Math.floor(q / 3),
      j = q % 3;
    return (
      (a.m[i * 3] ?? 0) * (b.m[j] ?? 0) +
      (a.m[i * 3 + 1] ?? 0) * (b.m[3 + j] ?? 0) +
      (a.m[i * 3 + 2] ?? 0) * (b.m[6 + j] ?? 0)
    );
  });
  const t = [0, 1, 2].map(
    (j) =>
      ((a.t[0] ?? 0) * (b.m[j] ?? 0) +
        (a.t[1] ?? 0) * (b.m[3 + j] ?? 0) +
        (a.t[2] ?? 0) * (b.m[6 + j] ?? 0)) *
        b.s +
      (b.t[j] ?? 0),
  );
  return { m, s: a.s * b.s, t };
};
const rot = (axis: 0 | 1 | 2, deg: number) => {
  const a = new Float32Array(X);
  setRotation(a, 0, axis, deg);
  return fromArr(a);
};
function refRib(h: Horn, i: number, ribs: number, w: number[]): Ref {
  if (ribs === 0 || h.rules.length === 0) return refId();
  return h.rules.map((r) => fromArr(rule2(r, i / ribs, w))).reduce(then);
}
const rule2 = (r: Rule, u: number, w: number[]) => {
  const o = new Float32Array(X);
  ruleAt(o, 0, r, u, w);
  return o;
};
function refExpand(g: Genome, t: number) {
  const w = WAVE_PERIODS.map((p, i) => Math.sin((2 * Math.PI * t) / p + (g.phase[i] ?? 0)));
  const out: { c: number[]; s: number }[] = [];
  const visit = (h: Horn | Ball, parent: Ref) => {
    if (h.prim === 'ball') {
      out.push({ c: parent.t, s: Math.abs(parent.s) });
      return;
    }
    const ribs = Math.max(0, value(h.ribs, w));
    for (let i = 0; i < ribs; i++) visit(h.child, then(refRib(h, i, ribs, w), parent));
    visit(h.child, then(refRib(h, ribs, ribs, w), parent));
    if (h.bulb !== null) {
      const tip = refRib(h, ribs, ribs, w);
      visit({ prim: 'ball', tone: 2 }, then({ ...tip, s: tip.s * h.bulb }, parent));
    }
  };
  const pose = then(rot(0, g.tiltAmp * (w[g.tiltOsc] ?? 0) - 15), rot(1, t * g.spin));
  for (let c = 0; c < g.copies; c++)
    for (let m = 0; m < (g.mirror ? 2 : 1); m++)
      visit(g.root, then(then(m ? rot(0, 180) : refId(), rot(2, (360 * c) / g.copies)), pose));
  return out;
}

describe('fast expansion', () => {
  it('a tube of n ribs draws ⌈n⌉ + 1 balls; nesting multiplies', () => {
    const g = randomGenome(1);
    const tube = (ribs: number, child: Horn | Ball): Horn => ({
      kind: 'taper',
      ribs,
      rules: [{ op: 'stack', a: 1 }],
      child,
      alt: false,
      bulb: null,
    });
    const inst = createInstances();
    expect(
      expand({ ...g, copies: 1, mirror: false, root: tube(5, { prim: 'ball', tone: 0 }) }, 0, inst),
    ).toBe(6);
    expect(
      expand(
        { ...g, copies: 1, mirror: false, root: tube(4.5, { prim: 'ball', tone: 0 }) },
        0,
        inst,
      ),
    ).toBe(6);
    expect(
      expand(
        { ...g, copies: 2, mirror: true, root: tube(3, tube(5, { prim: 'ball', tone: 0 })) },
        0,
        inst,
      ),
    ).toBe(4 * 6 * 4);
  });

  it('matches the naive reference (same centres and scales) for many genomes and times', () => {
    const inst = createInstances();
    let worst = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const g = randomGenome(seed * 7919);
      for (const t of [0, 3.7, 11.2]) {
        const ref = refExpand(g, t);
        const n = expand(g, t, inst);
        expect(n).toBe(ref.length);
        ref.forEach((r, i) => {
          const scale = 1 + Math.hypot(...r.c);
          worst = Math.max(
            worst,
            Math.abs((inst.x[i] ?? 0) - (r.c[0] ?? 0)) / scale,
            Math.abs((inst.y[i] ?? 0) - (r.c[1] ?? 0)) / scale,
            Math.abs((inst.z[i] ?? 0) - (r.c[2] ?? 0)) / scale,
            Math.abs((inst.s[i] ?? 0) - r.s) / (1e-6 + r.s),
          );
        });
      }
    }
    expect(worst).toBeLessThan(1e-4); // float32 rounding only
  });
});
