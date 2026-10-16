/**
 * Demo genomes: small trees of horns in the spirit of Todd & Latham's FormSynth horn grammar
 * (a horn is a tube of ribs shaped by stack / bend / twist / grow / branch rules; a rib can be
 * a horn again). The families, parameter ranges, waves and mutation operators are this game's
 * own (docs/feature_demo.md); no form of the original Organic Art is reproduced.
 *
 * Motion (§Swirl): slow, large oscillations of bends, twists and caps make the tubes wind and
 * unwind — each rib turns by u·angle(t), so outer ribs turn more and spirals breathe. A
 * `ripple` (this game's extension) shifts a wave's phase with the parent rib's position, so a
 * wave travels round the tentacles of an anemone. Colour genes paint stripes, flowing colour
 * waves or one colour per tentacle, and pulse light along the tubes.
 *
 * House rules every genome obeys (`structureOk`): `stack` and `tilt` may only open a horn,
 * and `bend` and `twist` are never neighbours.
 */
import type { DemoRng } from './rng';
import { demoRng } from './rng';
import type { Shape } from './sprites';

/**
 * Wave periods in seconds, slow to fast; each genome adds its own phases. 0–3 drive swirls and
 * the pose, 4–6 breathing, 7–8 a light shimmer.
 */
export const WAVE_PERIODS = [41, 31, 23, 17, 13, 9.5, 7, 4.5, 3] as const;
export const WAVES = WAVE_PERIODS.length;
const SLOW = [0, 3] as const;
const MID = [3, 6] as const;

/**
 * A constant, or a base plus one or two waves. `ripple` (radians) shifts the waves' phase by
 * ripple × the parent rib's position (0…1): neighbouring tentacles move out of step.
 */
export type Param =
  | number
  | { base: number; amp: number; osc: number; amp2?: number; osc2?: number; ripple?: number };

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
  /** What each rib looks like (a ball unless set). */
  shape?: Shape;
}

export const TENDRILS = ['taper', 'spring', 'shell', 'cone'] as const;
export const ARRANGEMENTS = ['fan', 'ring', 'tower', 'whorl', 'layers', 'flock'] as const;
export type TendrilKind = (typeof TENDRILS)[number];
export type ArrangementKind = (typeof ARRANGEMENTS)[number];

export interface Horn {
  /** Absent on horns; lets `node.prim === 'ball'` tell a ball from a horn. */
  prim?: never;
  kind: TendrilKind | ArrangementKind;
  ribs: Param;
  rules: Rule[];
  child: Horn | Ball;
  /** Alternate ribs swap colour ramps (colour mode `alt`). */
  alt: boolean;
  /** A bigger ball at the tip (scale relative to the last rib), or none. */
  bulb: number | null;
  /** The tip's shape (a ball unless set). */
  bulbShape?: Shape;
  /**
   * A strand (web forms): after its rules, the tube is moved back by `center` × its stack
   * length (0.5 = it turns about its middle) and turned `turn`° about Z (90 = lying sideways).
   */
  lay?: { center: number; turn: number };
  /**
   * Which ribs are drawn: absent or 1 = all, k ≥ 2 = every k-th (a string of separate beads),
   * 0 = none but the tip bulb (an invisible tube carrying it — fireflies on swirling paths).
   * Hidden ribs still count for rib size and the budget.
   */
  dots?: number;
}

export type DemoStyle = 'bobs' | 'wire';
export type Backdrop = 'bars' | 'stars';
/** `tumble`: the form sways in front of the camera; `vortex`: its axis faces the camera. */
export type View = 'tumble' | 'vortex';
/**
 * How copies are placed: `radial` round the axis; `swarm`: each on its own slow orbit round
 * the others (separate figures dancing round each other), `swarm` units from the centre.
 */
export type Layout = 'radial' | 'swarm';

export const COLOUR_MODES = ['alt', 'bands', 'flow', 'tentacles', 'mono'] as const;
export type ColourMode = (typeof COLOUR_MODES)[number];

/**
 * How balls are coloured along a tube (u = 0 at its root, 1 at its tip; p = the parent rib's
 * position): `bands` stripes `pattern[⌊u·bands⌋]`; `flow` moves those stripes along at `speed`
 * stripes per second (shifted by `ripple`·p); `tentacles` gives each tube one colour by its
 * parent rib; `alt` alternates ramps on flagged horns; `mono` is one ramp. `pulse` (0–0.6)
 * darkens balls in a light wave that travels the same way.
 */
export interface Colour {
  mode: ColourMode;
  pattern: Tone[];
  bands: number;
  speed: number;
  ripple: number;
  pulse: number;
}

export interface Genome {
  version: 2;
  root: Horn;
  /** Copies, and whether each copy is mirrored (flipped about X). */
  copies: number;
  mirror: boolean;
  layout: Layout;
  /** Swarm orbit size (world units). */
  swarm: number;
  phase: number[];
  view: View;
  /** Sway: a tilt of `tiltAmp`° on wave `tiltOsc`, a turn of `spinAmp`° on wave `spinOsc`… */
  tiltAmp: number;
  tiltOsc: number;
  spinAmp: number;
  spinOsc: number;
  /** …plus a slow steady drift in degrees per second. */
  drift: number;
  /**
   * The form's clock rate (1 = normal, 0 = frozen); it scales
   * waves, swirls, sway, drift, swarm orbits and colour flow, not the backdrop.
   */
  speed: number;
  /** Ball size relative to the gap between neighbouring ribs (lace 0.45 … solid tubes 2). */
  thickness: number;
  colour: Colour;
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

const osc = (r: DemoRng, band: readonly [number, number] = MID) => r.int(band[0], band[1]);

const R = (r: DemoRng, base: number, wobble = 0.3, two = 0.3): Param => {
  const p: Exclude<Param, number> = {
    base,
    amp: base * wobble * r.range(0.4, 1),
    osc: osc(r, [2, 8]),
  };
  if (r.chance(two)) {
    p.amp2 = p.amp * r.range(0.3, 0.8);
    p.osc2 = osc(r, [2, 8]);
  }
  return p;
};

/**
 * A swirl: a slow oscillation of ±`degrees` on top of an angle. Winding and unwinding over
 * tens of seconds is what makes the forms writhe instead of jitter.
 */
function swirl(r: DemoRng, p: Param, degrees: number): Param {
  const q = typeof p === 'number' ? { base: p, amp: 0, osc: osc(r) } : { ...p };
  q.amp2 = r.sign() * degrees;
  q.osc2 = osc(r, SLOW);
  return q;
}

const ball = (tone: Tone = 0): Ball => ({ prim: 'ball', tone });

const RIB_SHAPES: readonly (readonly [Shape, number])[] = [
  ['ball', 0.45],
  ['petal', 0.12],
  ['gem', 0.1],
  ['ring', 0.09],
  ['star', 0.08],
  ['cube', 0.08],
  ['drop', 0.08],
];
const TIP_SHAPES: readonly (readonly [Shape, number])[] = [
  ['ball', 0.5],
  ['star', 0.15],
  ['gem', 0.15],
  ['ring', 0.1],
  ['cube', 0.1],
];
function pickShape(r: DemoRng, table: readonly (readonly [Shape, number])[]): Shape {
  let x = r.f();
  for (const [shape, w] of table) if ((x -= w) < 0) return shape;
  return 'ball';
}
/** Give a tube's ribs (and its tip) a shape; balls are the default and are left unset. */
function setShapes(r: DemoRng, h: Horn): void {
  if (h.child.prim === 'ball') {
    const rib = pickShape(r, RIB_SHAPES);
    if (rib === 'ball') delete h.child.shape;
    else h.child.shape = rib;
  }
  const tip = pickShape(r, TIP_SHAPES);
  if (tip === 'ball') delete h.bulbShape;
  else h.bulbShape = tip;
}

type HornShape = Pick<Horn, 'ribs' | 'rules'>;

const TENDRIL: Record<TendrilKind, (r: DemoRng) => HornShape> = {
  // length, a slow spin of the ribs, shrink, then the curl (which sways)
  taper: (r) => ({
    ribs: R(r, r.int(14, 34), 0.15, 0),
    rules: [
      { op: 'stack', a: R(r, r.range(0.9, 2)) },
      { op: 'twist', a: R(r, r.sign() * r.range(30, 120), 0.6), b: 0 },
      { op: 'grow', a: r.range(0.35, 0.7) },
      { op: 'bend', a: swirl(r, R(r, r.sign() * r.range(40, 160), 0.3), r.range(40, 140)) },
    ],
  }),
  // an offset twist winds the ribs round a helix that winds and unwinds
  spring: (r) => ({
    ribs: R(r, r.int(22, 48), 0.1, 0),
    rules: [
      { op: 'stack', a: R(r, r.range(1, 2.6)) },
      {
        op: 'twist',
        a: swirl(r, R(r, r.sign() * r.range(400, 1500), 0.15), r.range(180, 540)),
        b: R(r, r.range(0.08, 0.32), 0.4),
      },
      { op: 'grow', a: r.range(0.45, 1.6) },
      ...(r.chance(0.5)
        ? [{ op: 'bend' as const, a: swirl(r, R(r, r.sign() * r.range(10, 50), 0.5), 40) }]
        : []),
    ],
  }),
  // a stacked tube bent through more than a turn while it shrinks: a breathing log spiral
  shell: (r) => ({
    ribs: R(r, r.int(26, 56), 0.1, 0),
    rules: [
      { op: 'stack', a: r.range(0.6, 1.4) },
      {
        op: 'bend',
        a: swirl(r, R(r, r.sign() * 360 * r.range(1.1, 2.6), 0.08), r.range(60, 180)),
      },
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
        {
          op: 'branch',
          a: swirl(r, R(r, r.range(40, 120), 0.2), r.range(20, 50)),
          k: r.pick([1, 2, 3]),
          n,
        },
        { op: 'grow', a: r.range(0.25, 0.8) },
      ],
    };
  },
};

const ARRANGE: Record<ArrangementKind, (r: DemoRng) => HornShape> = {
  // an anemone: the cap opens and closes slowly
  fan: (r) => {
    const n = r.int(5, 14);
    return {
      ribs: n,
      rules: [
        {
          op: 'branch',
          a: swirl(r, R(r, r.range(150, 320), 0.1), r.range(30, 80)),
          k: r.pick([1, 1, 2]),
          n,
        },
      ],
    };
  },
  ring: (r) => {
    const n = r.int(5, 11);
    return {
      ribs: n,
      rules: [
        { op: 'tilt', deg: r.range(-70, 70) },
        // a small offset keeps the children touching; a large one sets them apart
        {
          op: 'twist',
          a: 360 * (n / (n + 1)),
          b: R(r, r.chance(0.35) ? r.range(1, 2.2) : r.range(0.25, 0.7), 0.3),
        },
      ],
    };
  },
  // tiers that turn against each other: a vortex seen from above
  tower: (r) => ({
    ribs: r.int(3, 6),
    rules: [
      { op: 'stack', a: R(r, r.range(1.2, 2.6), 0.2) },
      {
        op: 'twist',
        a: swirl(r, R(r, r.sign() * r.range(90, 400), 0.2), r.range(90, 270)),
        b: 0,
      },
      { op: 'grow', a: r.range(0.3, 0.7) },
    ],
  }),
  // web layers: strands stacked a little apart, each one larger and turned against the last;
  // the turn swings slowly, so the layers wind into a spiral and back
  layers: (r) => ({
    ribs: r.int(4, 8),
    rules: [
      { op: 'stack', a: R(r, r.range(0.1, 0.4), 0.3) },
      {
        op: 'twist',
        a: swirl(r, R(r, r.sign() * r.range(90, 240), 0.2), r.range(60, 180)),
        b: 0,
      },
      { op: 'grow', a: R(r, r.range(1.6, 4), 0.2) },
    ],
  }),
  // an invisible carrier path with wide spacing: its children are far apart and swim along
  flock: (r) =>
    r.chance(0.5)
      ? {
          ribs: r.int(3, 7),
          rules: [
            { op: 'stack', a: swirl(r, R(r, r.range(2, 5), 0.2), 1.2) },
            {
              op: 'twist',
              a: swirl(r, R(r, r.sign() * r.range(200, 600), 0.2), r.range(120, 300)),
              b: R(r, r.range(0.6, 1.6), 0.3),
            },
            { op: 'grow', a: r.range(0.5, 1.2) },
          ],
        }
      : {
          ribs: r.int(3, 7),
          rules: [
            { op: 'stack', a: R(r, r.range(2.5, 5), 0.25) },
            { op: 'bend', a: swirl(r, R(r, r.sign() * r.range(90, 300), 0.2), r.range(60, 160)) },
            { op: 'grow', a: r.range(0.5, 1.1) },
          ],
        },
  whorl: (r) => ({
    ribs: r.int(6, 14),
    rules: [
      { op: 'stack', a: r.range(0.6, 1.4) },
      { op: 'bend', a: swirl(r, R(r, r.sign() * r.range(300, 640), 0.1), r.range(60, 180)) },
      { op: 'grow', a: r.range(0.25, 0.6) },
    ],
  }),
};

export function tendril(r: DemoRng, kind: TendrilKind = r.pick(TENDRILS)): Horn {
  const h: Horn = {
    kind,
    ...TENDRIL[kind](r),
    child: ball(),
    alt: r.chance(0.4),
    bulb: r.chance(0.35) ? r.range(1.2, 1.8) : null,
  };
  setDots(r, h, r.pick([1, 1, 1, 1, 1, 1, 2, 3, 0]));
  setShapes(r, h);
  return h;
}

/** Draw every k-th rib of a tube (0: only its tip bulb, which it then always has). */
function setDots(r: DemoRng, h: Horn, k: number): void {
  if (k === 1) delete h.dots;
  else h.dots = k;
  if (k === 0 && h.bulb === null) h.bulb = r.range(1.6, 2.6);
}

/** Every wave parameter of a horn's rules. */
function waveParams(h: Horn): Exclude<Param, number>[] {
  const out: Exclude<Param, number>[] = [];
  for (const rule of h.rules) {
    if (rule.op === 'tilt') continue;
    if (typeof rule.a === 'object') out.push(rule.a);
    if (rule.op === 'twist' && typeof rule.b === 'object') out.push(rule.b);
  }
  return out;
}

/** Make the tentacles of an arrangement move out of step (or in step again). */
function setRipple(r: DemoRng, h: Horn, on: boolean): void {
  const ripple = on ? r.pick([1, 2, 3]) * 2 * Math.PI * r.sign() : 0;
  for (const p of waveParams(h)) {
    if (ripple) p.ripple = ripple;
    else delete p.ripple;
  }
}

function arrangement(r: DemoRng, child: Horn, kind: ArrangementKind = r.pick(ARRANGEMENTS)): Horn {
  setRipple(r, child, r.chance(0.65));
  return { kind, ...ARRANGE[kind](r), child, alt: false, bulb: null };
}

/**
 * A web: a strand laid sideways about its middle, in swirling layers, repeated round a full
 * turn as spokes and seen face on. (The principle of Organic Art's web forms, rebuilt from
 * this game's own parts: tendril → layers → ring.)
 */
function web(r: DemoRng): Horn {
  // sized so spokes × layers × strand ribs stays inside the budget
  const strand = tendril(r, r.pick(['taper', 'spring'] as const));
  strand.ribs = r.int(8, 14);
  strand.lay = { center: r.range(0.35, 0.6), turn: 90 * r.sign() };
  strand.bulb = null;
  setRipple(r, strand, r.chance(0.5));
  const layers: Horn = {
    kind: 'layers',
    ...ARRANGE.layers(r),
    ribs: r.int(3, 5),
    child: strand,
    alt: false,
    bulb: null,
  };
  const n = r.int(5, 8);
  return {
    kind: 'ring',
    ribs: n,
    rules: [
      { op: 'tilt', deg: r.range(-12, 12) },
      { op: 'twist', a: 360 * (n / (n + 1)), b: R(r, r.range(0, 0.2), 0.5) },
    ],
    child: layers,
    alt: false,
    bulb: null,
  };
}

export function randomColour(r: DemoRng): Colour {
  const mode = r.pick<ColourMode>(['alt', 'bands', 'flow', 'flow', 'tentacles', 'mono']);
  const pattern = r.pick<Tone[]>([
    [0, 1],
    [0, 1, 2, 1],
    [0, 0, 1],
    [0, 2],
    [1, 0, 2],
  ]);
  return {
    mode,
    pattern,
    bands: r.int(2, 6),
    speed: r.sign() * r.range(0.2, 1.2),
    ripple: r.chance(0.5) ? r.int(1, 3) : 0,
    pulse: r.chance(0.45) ? r.range(0.2, 0.6) : 0,
  };
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

/**
 * What kind of picture a first demo is (drawn first, so the judge's taste — which loves spread-out
 * radial forms — cannot crowd the others out): a lone creature, figures dancing round each
 * other, a flock carried by an invisible path, a radial form, or a web.
 */
export const ARCHETYPES = ['solo', 'swarm', 'flock', 'radial', 'web'] as const;
export type Archetype = (typeof ARCHETYPES)[number];
const ARCHETYPE_WEIGHTS: Readonly<Record<Archetype, number>> = {
  solo: 0.2,
  swarm: 0.2,
  flock: 0.18,
  radial: 0.3,
  web: 0.12,
};

export function archetypeFor(seed: number): Archetype {
  let x = demoRng(seed ^ 0x2c1b3c6d).f();
  for (const a of ARCHETYPES) if ((x -= ARCHETYPE_WEIGHTS[a]) < 0) return a;
  return 'radial';
}

const RADIAL: readonly ArrangementKind[] = ['fan', 'ring', 'tower', 'whorl', 'layers'];

function rootFor(r: DemoRng, archetype: Archetype, family?: TendrilKind): Horn {
  if (family) return tendril(r, family);
  switch (archetype) {
    case 'web':
      return web(r);
    case 'solo':
      return tendril(r);
    case 'swarm':
      return r.chance(0.6)
        ? tendril(r)
        : arrangement(r, tendril(r), r.pick(['tower', 'flock'] as const));
    case 'flock': {
      const inner = tendril(r);
      if (r.chance(0.5)) setDots(r, inner, r.pick([0, 2, 3]));
      const flock = arrangement(r, inner, 'flock');
      return r.chance(0.3) ? arrangement(r, flock, 'flock') : flock;
    }
    case 'radial': {
      let root = arrangement(r, tendril(r), r.pick(RADIAL));
      if (r.chance(0.25)) root = arrangement(r, root, r.pick(RADIAL));
      return root;
    }
  }
}

/** A first genome from a seed (house rules and budget hold; looks are the judge's business). */
export function randomGenome(seed: number, family?: TendrilKind, archetype?: Archetype): Genome {
  const r = demoRng(seed);
  const kind = archetype ?? archetypeFor(seed);
  for (let attempt = 0; attempt < 20; attempt++) {
    const root = rootFor(r, kind, family);
    const many =
      kind === 'swarm'
        ? r.int(2, 5)
        : kind === 'solo'
          ? r.pick([1, 1, 2])
          : kind === 'radial'
            ? r.pick([1, 1, 2, 3, 4, 5, 6])
            : r.pick([1, 1, 2]);
    const g: Genome = {
      version: 2,
      root,
      copies: family || kind === 'web' ? 1 : many,
      mirror: !family && kind !== 'web' && r.chance(0.25),
      layout: kind === 'swarm' || (kind !== 'radial' && r.chance(0.5)) ? 'swarm' : 'radial',
      swarm: r.range(1, 2.6),
      phase: WAVE_PERIODS.map(() => r.range(0, Math.PI * 2)),
      view: kind === 'web' || (kind === 'radial' && r.chance(0.45)) ? 'vortex' : 'tumble',
      tiltAmp: r.range(10, 40),
      tiltOsc: osc(r, SLOW),
      spinAmp: r.range(40, 160),
      spinOsc: osc(r, SLOW),
      drift: r.sign() * r.range(0, 5),
      // mostly between a third and twice the normal pace
      speed: Math.exp(r.range(Math.log(0.4), Math.log(2))),
      // overlapping balls make solid tubes; radial forms stay finer, webs are lace
      thickness:
        kind === 'web'
          ? r.range(0.45, 0.7)
          : kind === 'radial'
            ? r.range(0.7, 1.25)
            : r.range(1, 2),
      colour: randomColour(r),
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
    version: 2,
    root: { ...tendril(r, 'spring'), bulb: null },
    copies: 1,
    mirror: false,
    layout: 'radial',
    swarm: 1.5,
    phase: WAVE_PERIODS.map(() => 0),
    view: 'tumble',
    tiltAmp: 20,
    tiltOsc: 0,
    spinAmp: 90,
    spinOsc: 1,
    drift: 3,
    speed: 1,
    thickness: 1,
    colour: { mode: 'flow', pattern: [0, 1], bands: 3, speed: 0.5, ripple: 0, pulse: 0.3 },
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

/** A short hash of a genome (tests and the UI check that a preview is what gets built). */
export function genomeFingerprint(g: Genome): string {
  const text = JSON.stringify(g);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

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
    if ('a' in rule && typeof rule.a === 'object') rule.a = { ...rule.a, osc: osc(r, [2, 8]) };
  },
  /** Add, retime or remove a slow swirl on one angle. */
  swirl: (g: Genome, r: DemoRng) => {
    const rule = r.pick(r.pick(hornChain(g.root)).rules);
    if (rule.op === 'bend' || rule.op === 'twist' || rule.op === 'branch') {
      const big = rule.op === 'twist' ? r.range(120, 540) : r.range(30, 150);
      if (typeof rule.a === 'object' && rule.a.amp2 !== undefined && r.chance(0.3)) {
        const { amp2: _amp2, osc2: _osc2, ...rest } = rule.a;
        rule.a = rest;
      } else rule.a = swirl(r, rule.a, big);
    }
  },
  /** Tentacles in step, or a wave running round them. */
  ripple: (g: Genome, r: DemoRng) => {
    const chain = hornChain(g.root);
    const inner = chain.at(-1);
    if (inner && chain.length > 1) {
      setRipple(r, inner, !waveParams(inner).some((p) => p.ripple));
    }
  },
  view: (g: Genome) => {
    g.view = g.view === 'tumble' ? 'vortex' : 'tumble';
  },
  /** Solid, beaded, or invisible but for the bulb at its tip. */
  dots: (g: Genome, r: DemoRng) => {
    const inner = hornChain(g.root).at(-1);
    if (inner) setDots(r, inner, r.pick([1, 2, 3, 0].filter((k) => k !== (inner.dots ?? 1))));
  },
  /** Other shapes for the ribs and the tip. */
  shape: (g: Genome, r: DemoRng) => {
    const inner = hornChain(g.root).at(-1);
    if (inner) setShapes(r, inner);
  },
  /** Copies round the axis, or dancing round each other. */
  layout: (g: Genome, r: DemoRng) => {
    g.layout = g.layout === 'radial' ? 'swarm' : 'radial';
    if (g.copies < 2) g.copies = r.int(2, 5);
  },
  thickness: (g: Genome, r: DemoRng) => {
    g.thickness = Math.max(0.4, Math.min(2.2, g.thickness * Math.exp(r.range(-0.35, 0.35))));
  },
  /** Lay the innermost tube down as a strand about its middle, or stand it up again. */
  lay: (g: Genome, r: DemoRng) => {
    const inner = hornChain(g.root).at(-1);
    if (!inner) return;
    if (inner.lay) delete inner.lay;
    else inner.lay = { center: r.range(0.35, 0.6), turn: 90 * r.sign() };
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
      { op: 'bend', a: swirl(r, R(r, r.sign() * r.range(15, 60), 0.4), r.range(20, 80)) },
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
  /** A new way of colouring the balls, or a twist on the current one. */
  colour: (g: Genome, r: DemoRng) => {
    const c = g.colour;
    switch (r.int(0, 4)) {
      case 0:
        g.colour = randomColour(r);
        break;
      case 1:
        c.bands = Math.max(1, Math.min(8, c.bands + r.pick([-1, 1, 2])));
        break;
      case 2:
        c.speed = -c.speed * r.range(0.6, 1.6);
        break;
      case 3:
        c.pulse = c.pulse > 0 ? 0 : r.range(0.2, 0.6);
        break;
      default:
        c.ripple = c.ripple ? 0 : r.int(1, 3);
    }
  },
  palette: (g: Genome, r: DemoRng) => {
    g.palette = (g.palette + r.int(1, PALETTE_COUNT - 1)) % PALETTE_COUNT;
  },
  backdrop: (g: Genome) => {
    g.backdrop = g.backdrop === 'bars' ? 'stars' : 'bars';
  },
  /** Off 37 % of the time, otherwise light or heavy trails. */
  trails: (g: Genome, r: DemoRng) => {
    g.trails = r.chance(0.374) ? 0 : r.pick([2, 3] as const);
  },
  /** A new speed drawn uniformly from [0, 8): frozen, slowed or several times faster. */
  speed: (g: Genome, r: DemoRng) => {
    g.speed = r.f() * 8;
  },
} satisfies Record<string, (g: Genome, r: DemoRng) => void>;

export type MutationId = keyof typeof MUTATIONS;
export const COSMETIC: ReadonlySet<MutationId> = new Set([
  'colour',
  'shape',
  'palette',
  'backdrop',
  'trails',
]);

const WEIGHTS: readonly [MutationId, number][] = [
  ['tweak', 6],
  ['wave', 1.5],
  ['swirl', 2],
  ['ripple', 1],
  ['view', 0.5],
  ['lay', 0.6],
  ['thickness', 1],
  ['dots', 1],
  ['shape', 1.5],
  ['layout', 0.8],
  ['speed', 2.5],
  ['ribs', 2],
  ['addRule', 1.5],
  ['dropRule', 1],
  ['wrap', 1],
  ['unwrap', 0.6],
  ['copies', 1],
  ['bulb', 1],
  ['swapTendril', 0.5],
  ['colour', 2.5],
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
