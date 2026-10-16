/**
 * Demo genomes: small trees of horns in the spirit of Todd & Latham's FormSynth horn grammar
 * (a horn is a tube of ribs shaped by stack / bend / twist / grow / branch rules; a rib can be
 * a horn again). The families, parameter ranges, waves and mutation operators are this game's
 * own (docs/feature_demo.md); no form of the original Organic Art is reproduced.
 *
 * House rules every genome obeys (`structureOk`): `stack` and `tilt` may only open a horn,
 * and `bend` and `twist` are never neighbours.
 */
import type { DemoRng } from './rng';
import { demoRng } from './rng';

/** Wave periods in seconds; each genome adds its own phases. */
export const WAVE_PERIODS = [3.3, 4.7, 6.9, 9.1, 13.7, 2.2, 1.45] as const;
export const WAVES = WAVE_PERIODS.length;

/** A constant, or a base plus one or two waves. */
export type Param =
  number | { base: number; amp: number; osc: number; amp2?: number; osc2?: number };

export type Rule =
  | { op: 'stack' | 'bend' | 'grow'; a: Param }
  | { op: 'twist'; a: Param; b: Param }
  /** Golden-angle spread over a sphere cap of `a` degrees; `n` = the horn's ribs when added. */
  | { op: 'branch'; a: Param; k: number; n: number }
  /** A fixed tilt about X for every rib (only as a ring's first rule). */
  | { op: 'tilt'; deg: number };

export type Tone = 0 | 1 | 2;
export interface Ball {
  prim: 'ball';
  tone: Tone;
}

export const TENDRILS = ['taper', 'spring', 'shell', 'cone'] as const;
export const ARRANGEMENTS = ['fan', 'ring', 'tower', 'whorl'] as const;
export type TendrilKind = (typeof TENDRILS)[number];
export type ArrangementKind = (typeof ARRANGEMENTS)[number];

export interface Horn {
  /** Absent on horns; lets `node.prim === 'ball'` tell a ball from a horn. */
  prim?: never;
  kind: TendrilKind | ArrangementKind;
  ribs: Param;
  rules: Rule[];
  child: Horn | Ball;
  /** Alternate ribs swap colour ramps. */
  alt: boolean;
  /** A bigger ball at the tip (scale relative to the last rib), or none. */
  bulb: number | null;
}

export type DemoStyle = 'bobs' | 'wire';
export type Backdrop = 'bars' | 'stars';

export interface Genome {
  version: 1;
  root: Horn;
  /** Radial copies about Z, and whether each copy is mirrored (flipped about X). */
  copies: number;
  mirror: boolean;
  phase: number[];
  /** Degrees per second about Y, and a slow tilt about X driven by one wave. */
  spin: number;
  tiltAmp: number;
  tiltOsc: number;
  palette: number;
  style: DemoStyle;
  backdrop: Backdrop;
  /** 0 = clear every frame; n = fade old pixels one shade every n frames. */
  trails: 0 | 2 | 3;
}

/** Rib instances one frame may draw (copies and mirror included). */
export const BUDGET = 900;
export const MIN_INSTANCES = 12;
export const PALETTE_COUNT = 8;

const R = (r: DemoRng, base: number, wobble = 0.3, two = 0.3): Param => {
  const p: Exclude<Param, number> = {
    base,
    amp: base * wobble * r.range(0.4, 1),
    osc: r.int(0, WAVES - 1),
  };
  if (r.chance(two)) {
    p.amp2 = p.amp * r.range(0.3, 0.8);
    p.osc2 = r.int(0, WAVES - 1);
  }
  return p;
};
const ball = (tone: Tone = 0): Ball => ({ prim: 'ball', tone });

type Shape = Pick<Horn, 'ribs' | 'rules'>;

const TENDRIL: Record<TendrilKind, (r: DemoRng) => Shape> = {
  // length, a slow spin of the ribs, shrink, then the curl
  taper: (r) => ({
    ribs: R(r, r.int(14, 34), 0.15, 0),
    rules: [
      { op: 'stack', a: R(r, r.range(0.9, 2)) },
      { op: 'twist', a: R(r, r.sign() * r.range(30, 120), 0.6), b: 0 },
      { op: 'grow', a: r.range(0.35, 0.7) },
      { op: 'bend', a: R(r, r.sign() * r.range(40, 160), 0.5) },
    ],
  }),
  // an offset twist winds the ribs round a helix that swells or thins as it goes
  spring: (r) => ({
    ribs: R(r, r.int(22, 48), 0.1, 0),
    rules: [
      { op: 'stack', a: R(r, r.range(1, 2.6)) },
      {
        op: 'twist',
        a: R(r, r.sign() * r.range(400, 1500), 0.25),
        b: R(r, r.range(0.08, 0.32), 0.4),
      },
      { op: 'grow', a: r.range(0.45, 1.6) },
      ...(r.chance(0.5) ? [{ op: 'bend' as const, a: R(r, r.sign() * r.range(10, 50), 0.8) }] : []),
    ],
  }),
  // a stacked tube bent through more than a turn while it shrinks: a logarithmic spiral
  shell: (r) => ({
    ribs: R(r, r.int(26, 56), 0.1, 0),
    rules: [
      { op: 'stack', a: r.range(0.6, 1.4) },
      { op: 'bend', a: R(r, r.sign() * 360 * r.range(1.1, 2.6), 0.12) },
      { op: 'grow', a: R(r, r.range(0.12, 0.4), 0.25) },
    ],
  }),
  // phyllotaxis inside a tube: every rib tilts a little further round the golden angle
  cone: (r) => {
    const n = r.int(30, 70);
    return {
      ribs: n,
      rules: [
        { op: 'stack', a: R(r, r.range(1, 2), 0.2) },
        { op: 'branch', a: R(r, r.range(40, 120), 0.3), k: r.pick([1, 2, 3]), n },
        { op: 'grow', a: r.range(0.25, 0.8) },
      ],
    };
  },
};

const ARRANGE: Record<ArrangementKind, (r: DemoRng) => Shape> = {
  fan: (r) => {
    const n = r.int(5, 14);
    return {
      ribs: n,
      rules: [{ op: 'branch', a: R(r, r.range(150, 340), 0.25), k: r.pick([1, 1, 2]), n }],
    };
  },
  ring: (r) => {
    const n = r.int(5, 11);
    return {
      ribs: n,
      rules: [
        { op: 'tilt', deg: r.range(-70, 70) },
        { op: 'twist', a: 360 * (n / (n + 1)), b: R(r, r.range(0.25, 0.7), 0.3) },
      ],
    };
  },
  tower: (r) => ({
    ribs: r.int(3, 6),
    rules: [
      { op: 'stack', a: R(r, r.range(1.2, 2.6), 0.2) },
      { op: 'twist', a: R(r, r.sign() * r.range(90, 400), 0.4), b: 0 },
      { op: 'grow', a: r.range(0.3, 0.7) },
    ],
  }),
  whorl: (r) => ({
    ribs: r.int(6, 14),
    rules: [
      { op: 'stack', a: r.range(0.6, 1.4) },
      { op: 'bend', a: R(r, r.sign() * r.range(300, 640), 0.15) },
      { op: 'grow', a: r.range(0.25, 0.6) },
    ],
  }),
};

export function tendril(r: DemoRng, kind: TendrilKind = r.pick(TENDRILS)): Horn {
  return {
    kind,
    ...TENDRIL[kind](r),
    child: ball(),
    alt: r.chance(0.4),
    bulb: r.chance(0.35) ? r.range(1.2, 1.8) : null,
  };
}

function arrangement(r: DemoRng, child: Horn, kind: ArrangementKind = r.pick(ARRANGEMENTS)): Horn {
  return { kind, ...ARRANGE[kind](r), child, alt: false, bulb: null };
}

const maxOf = (p: Param) =>
  typeof p === 'number' ? p : p.base + Math.abs(p.amp) + Math.abs(p.amp2 ?? 0);

function hornCount(h: Horn): number {
  const inner = h.child.prim === 'ball' ? 1 : hornCount(h.child);
  return (Math.ceil(Math.max(0, maxOf(h.ribs))) + 1) * inner + (h.bulb === null ? 0 : 1);
}

/** The most rib instances a frame of this genome can draw. */
export function instanceBound(g: Genome): number {
  return hornCount(g.root) * g.copies * (g.mirror ? 2 : 1);
}

/** The horns from the root down to the innermost tendril. */
export function hornChain(root: Horn): Horn[] {
  const out: Horn[] = [];
  for (let h: Horn | Ball = root; h.prim !== 'ball'; h = h.child) out.push(h);
  return out;
}

/** The house rules (see the file comment). */
export function structureOk(g: Genome): boolean {
  return hornChain(g.root).every((h) =>
    h.rules.every((rule, i) => {
      if ((rule.op === 'stack' || rule.op === 'tilt') && i > 0) return false;
      const next = h.rules[i + 1]?.op;
      return !(
        (rule.op === 'bend' && next === 'twist') ||
        (rule.op === 'twist' && next === 'bend')
      );
    }),
  );
}

export function withinBudget(g: Genome): boolean {
  const n = instanceBound(g);
  return n >= MIN_INSTANCES && n <= BUDGET;
}

/** A first genome from a seed (house rules and budget hold; looks are the judge's business). */
export function randomGenome(seed: number, family?: TendrilKind): Genome {
  const r = demoRng(seed);
  for (let attempt = 0; attempt < 20; attempt++) {
    let root = tendril(r, family);
    const levels = family ? 0 : r.pick([0, 1, 1, 1, 2]);
    for (let l = 0; l < levels; l++) root = arrangement(r, root);
    const g: Genome = {
      version: 1,
      root,
      copies: family ? 1 : r.pick([1, 1, 1, 2, 3, 4, 5, 6]),
      mirror: !family && r.chance(0.3),
      phase: WAVE_PERIODS.map(() => r.range(0, Math.PI * 2)),
      spin: r.sign() * r.range(8, 30),
      tiltAmp: r.range(10, 50),
      tiltOsc: r.int(0, WAVES - 1),
      palette: r.int(0, PALETTE_COUNT - 1),
      style: styleFor(seed),
      backdrop: r.chance(0.35) ? 'stars' : 'bars',
      trails: r.pick([0, 0, 0, 2, 3] as const),
    };
    if (withinBudget(g) && structureOk(g)) return g;
  }
  return fallbackGenome();
}

/** A small, always-valid spring (used when a seed keeps drawing duds). */
export function fallbackGenome(): Genome {
  const r = demoRng(1);
  return {
    version: 1,
    root: { ...tendril(r, 'spring'), bulb: null },
    copies: 1,
    mirror: false,
    phase: WAVE_PERIODS.map(() => 0),
    spin: 15,
    tiltAmp: 20,
    tiltOsc: 0,
    palette: 0,
    style: 'bobs',
    backdrop: 'bars',
    trails: 0,
  };
}

/**
 * Bobs or vector lines: drawn per demo from its own seed, never inherited (a lineage that
 * turned to lines would otherwise stay lines; the judge cannot see the style).
 */
export function styleFor(seed: number): DemoStyle {
  return demoRng(seed ^ 0x5bd1e995).chance(0.2) ? 'wire' : 'bobs';
}

export const cloneGenome = (g: Genome): Genome => JSON.parse(JSON.stringify(g)) as Genome;

// ---- mutation ----

const nudge = (r: DemoRng, p: Param, k = 0.25): Param =>
  typeof p === 'number'
    ? p * Math.exp(r.range(-k, k))
    : { ...p, base: p.base * Math.exp(r.range(-k, k)), amp: p.amp * Math.exp(r.range(-k, k)) };

/** Mutation operators; `cosmetic` ones change only colours and drawing, never the form. */
export const MUTATIONS = {
  tweak: (g: Genome, r: DemoRng) => {
    const rule = r.pick(r.pick(hornChain(g.root)).rules);
    if (rule.op === 'tilt') rule.deg = Math.max(-80, Math.min(80, rule.deg + r.range(-25, 25)));
    else if (rule.op === 'twist') {
      rule.a = nudge(r, rule.a);
      rule.b = nudge(r, rule.b);
    } else rule.a = nudge(r, rule.a);
  },
  wave: (g: Genome, r: DemoRng) => {
    const rule = r.pick(r.pick(hornChain(g.root)).rules);
    if ('a' in rule && typeof rule.a === 'object') rule.a = { ...rule.a, osc: r.int(0, WAVES - 1) };
  },
  ribs: (g: Genome, r: DemoRng) => {
    const h = r.pick(hornChain(g.root));
    if (typeof h.ribs === 'number') {
      h.ribs = Math.max(2, Math.round(h.ribs * r.range(0.7, 1.4)));
      for (const rule of h.rules) if (rule.op === 'branch') rule.n = h.ribs;
    } else h.ribs = nudge(r, h.ribs, 0.3);
  },
  addRule: (g: Genome, r: DemoRng) => {
    const h = r.pick(hornChain(g.root));
    if (h.rules.length >= 5) return;
    const rule: Rule = r.pick<Rule>([
      { op: 'bend', a: R(r, r.sign() * r.range(15, 60), 0.6) },
      { op: 'twist', a: R(r, r.range(60, 360), 0.5), b: 0 },
      { op: 'grow', a: r.range(0.6, 1.5) },
    ]);
    h.rules.splice(r.int(1, h.rules.length), 0, rule);
  },
  dropRule: (g: Genome, r: DemoRng) => {
    const h = r.pick(hornChain(g.root));
    const i = r.int(1, h.rules.length - 1);
    const rule = h.rules[i];
    if (h.rules.length > 2 && rule && rule.op !== 'branch') h.rules.splice(i, 1);
  },
  wrap: (g: Genome, r: DemoRng) => {
    if (hornChain(g.root).length < 3) g.root = arrangement(r, g.root);
  },
  unwrap: (g: Genome) => {
    if (g.root.child.prim !== 'ball') g.root = g.root.child;
  },
  copies: (g: Genome, r: DemoRng) => {
    g.copies = r.pick([1, 2, 3, 4, 5, 6]);
    if (r.chance(0.3)) g.mirror = !g.mirror;
  },
  bulb: (g: Genome, r: DemoRng) => {
    const tip = hornChain(g.root).at(-1);
    if (tip) tip.bulb = tip.bulb === null ? r.range(1.2, 1.8) : null;
  },
  swapTendril: (g: Genome, r: DemoRng) => {
    const chain = hornChain(g.root);
    const parent = chain.at(-2);
    if (parent) parent.child = tendril(r);
    else g.root = tendril(r);
  },
  palette: (g: Genome, r: DemoRng) => {
    g.palette = (g.palette + r.int(1, PALETTE_COUNT - 1)) % PALETTE_COUNT;
  },
  backdrop: (g: Genome) => {
    g.backdrop = g.backdrop === 'bars' ? 'stars' : 'bars';
  },
  trails: (g: Genome, r: DemoRng) => {
    g.trails = r.pick([0, 2, 3] as const);
  },
} satisfies Record<string, (g: Genome, r: DemoRng) => void>;

export type MutationId = keyof typeof MUTATIONS;
export const COSMETIC: ReadonlySet<MutationId> = new Set(['palette', 'backdrop', 'trails']);

const WEIGHTS: readonly [MutationId, number][] = [
  ['tweak', 6],
  ['wave', 2],
  ['ribs', 2],
  ['addRule', 1.5],
  ['dropRule', 1],
  ['wrap', 1],
  ['unwrap', 0.6],
  ['copies', 1],
  ['bulb', 1],
  ['swapTendril', 0.5],
  ['palette', 1],
  ['backdrop', 0.4],
  ['trails', 0.4],
];
const TOTAL_WEIGHT = WEIGHTS.reduce((sum, [, w]) => sum + w, 0);

export interface Mutant {
  genome: Genome;
  ops: MutationId[];
}

/** 1–3 operators on a copy of `parent`; null when no try kept the house rules and budget. */
export function mutate(parent: Genome, seed: number): Mutant | null {
  const r = demoRng(seed);
  for (let attempt = 0; attempt < 12; attempt++) {
    const genome = cloneGenome(parent);
    const ops: MutationId[] = [];
    for (let k = r.int(1, 3); k > 0; k--) {
      let x = r.f() * TOTAL_WEIGHT;
      const entry = WEIGHTS.find(([, w]) => (x -= w) < 0) ?? WEIGHTS[0];
      if (!entry) break;
      MUTATIONS[entry[0]](genome, r);
      ops.push(entry[0]);
    }
    if (withinBudget(genome) && structureOk(genome)) return { genome, ops };
  }
  return null;
}
