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
import {
  compose,
  constantWaves,
  createInstances,
  expand,
  ruleAt,
  setRotation,
  value,
  type WaveContext,
} from './horn';

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
const still = constantWaves(new Array<number>(WAVE_PERIODS.length).fill(0));
const rule = (r: Rule, u: number) => {
  const o = new Float32Array(X);
  ruleAt(o, 0, r, u, still);
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

  it('waves add to a base; a ripple shifts their phase by the parent rib', () => {
    const p: Param = { base: 1, amp: 2, osc: 1, amp2: 1, osc2: 2 };
    expect(value(p, constantWaves([0, 0.5, -1]))).toBe(1);
    const rippled: Param = { base: 0, amp: 1, osc: 0, ripple: Math.PI };
    const ctx: WaveContext = { w: [0], t: 0, phase: [Math.PI / 2], up: 0 };
    expect(value(rippled, ctx)).toBeCloseTo(0); // up = 0: the cached wave
    ctx.up = 0.5;
    expect(value(rippled, ctx)).toBeCloseTo(Math.sin(Math.PI / 2 + Math.PI / 2));
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
const move = (y: number): Ref => ({ ...refId(), t: [0, y, 0] });

function refRib(h: Horn, i: number, ribs: number, ctx: WaveContext): Ref {
  let xf = refId();
  if (ribs !== 0 && h.rules.length > 0) {
    xf = h.rules
      .map((r) => {
        const o = new Float32Array(X);
        ruleAt(o, 0, r, i / ribs, ctx);
        return fromArr(o);
      })
      .reduce(then);
  }
  if (h.lay) {
    const stack = h.rules.find((r) => r.op === 'stack');
    const length = stack?.op === 'stack' ? value(stack.a, ctx) : 1;
    xf = then(xf, then(move(-h.lay.center * length), rot(2, h.lay.turn)));
  }
  return xf;
}

function refExpand(g: Genome, t: number) {
  const w = WAVE_PERIODS.map((p, i) => Math.sin((2 * Math.PI * t) / p + (g.phase[i] ?? 0)));
  const out: { c: number[]; s: number }[] = [];
  const visit = (h: Horn | Ball, parent: Ref, up: number) => {
    if (h.prim === 'ball') {
      out.push({ c: parent.t, s: Math.abs(parent.s) });
      return;
    }
    const ctx: WaveContext = { w, t, phase: g.phase, up };
    const ribs = Math.max(0, value(h.ribs, ctx));
    const span = Math.max(1, Math.ceil(ribs));
    let j = 0;
    for (let i = 0; i < ribs; i++, j++) {
      visit(h.child, then(refRib(h, i, ribs, ctx), parent), j / span);
    }
    visit(h.child, then(refRib(h, ribs, ribs, ctx), parent), j / span);
    if (h.bulb !== null) {
      const tip = refRib(h, ribs, ribs, ctx);
      visit({ prim: 'ball', tone: 2 }, then({ ...tip, s: tip.s * h.bulb }, parent), 0);
    }
  };
  const tilt = g.tiltAmp * (w[g.tiltOsc] ?? 0);
  const turn = g.spinAmp * (w[g.spinOsc] ?? 0) + g.drift * t;
  const pose =
    g.view === 'vortex'
      ? then(rot(0, -90 + tilt * 0.4), rot(2, turn))
      : then(rot(0, tilt - 15), rot(1, turn));
  for (let c = 0; c < g.copies; c++)
    for (let m = 0; m < (g.mirror ? 2 : 1); m++)
      visit(g.root, then(then(m ? rot(0, 180) : refId(), rot(2, (360 * c) / g.copies)), pose), 0);
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
    const ball: Ball = { prim: 'ball', tone: 0 };
    expect(expand({ ...g, copies: 1, mirror: false, root: tube(5, ball) }, 0, inst)).toBe(6);
    expect(expand({ ...g, copies: 1, mirror: false, root: tube(4.5, ball) }, 0, inst)).toBe(6);
    expect(expand({ ...g, copies: 2, mirror: true, root: tube(3, tube(5, ball)) }, 0, inst)).toBe(
      4 * 6 * 4,
    );
  });

  it('matches the naive reference (ripples, strands, both views) for many genomes and times', () => {
    const inst = createInstances();
    let worst = 0;
    const seen = { ripple: 0, lay: 0, vortex: 0 };
    for (let seed = 1; seed <= 60; seed++) {
      const g = randomGenome(seed * 7919);
      const json = JSON.stringify(g);
      if (/"ripple":-?[1-9]/.test(json)) seen.ripple++;
      if (json.includes('"lay"')) seen.lay++;
      if (g.view === 'vortex') seen.vortex++;
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
    // the sample really exercised the new genes
    expect(seen.ripple).toBeGreaterThan(5);
    expect(seen.lay).toBeGreaterThan(2);
    expect(seen.vortex).toBeGreaterThan(10);
  });

  it('colour genes paint balls: flowing stripes move, pulses dim, the tip bulb is accent', () => {
    const inst = createInstances();
    const g = randomGenome(4, 'taper');
    const flow: Genome = {
      ...g,
      root: { ...g.root, bulb: 1.5 },
      colour: { mode: 'flow', pattern: [0, 1], bands: 3, speed: 1, ripple: 0, pulse: 0.5 },
    };
    const at = (t: number) => {
      const n = expand(flow, t, inst);
      return { tones: [...inst.tone.slice(0, n)], glow: [...inst.glow.slice(0, n)] };
    };
    const a = at(0),
      b = at(0.5);
    expect(new Set(a.tones.slice(0, -1)).size).toBe(2); // stripes along the tube
    expect(a.tones.slice(0, -1)).not.toEqual(b.tones.slice(0, -1)); // and they move
    expect(Math.min(...a.glow)).toBeLessThan(0.75);
    expect(a.tones.at(-1)).toBe(2); // the bulb
    const mono: Genome = { ...flow, colour: { ...flow.colour, mode: 'mono', pulse: 0 } };
    const n = expand(mono, 0, inst);
    expect(new Set(inst.tone.slice(0, n - 1))).toEqual(new Set([0]));
  });
});
