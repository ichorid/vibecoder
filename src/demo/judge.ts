/**
 * The judge picks each next demo: it tries mutations of the previous genome and keeps the
 * best-scoring child that is viable and visibly different. It never renders pixels; it splats
 * the projected ribs onto an 80×50 occupancy mask (docs/feature_demo.md §Judge).
 *
 * Score (higher is better), averaged over three moments:
 *   −3·|coverage − 0.28| + spread/160            fill about 28 % of the screen, spread out
 *   −12·max(0, ribSize/formRadius − 0.06)        fine ribs, not a few huge balls
 *   −6·max(0, biggestBall/formRadius − 0.22)     no bulb that swallows the form
 *   +1.2·min(detail, 0.5)                        lace and tendrils, not a solid blob
 *   −0.4·min(1, |ln(motion / 0.25)|)             lively, neither frozen nor frantic
 *   +0.6·novelty                                 differs from the last few ancestors
 */
import {
  COSMETIC,
  cloneGenome,
  fallbackGenome,
  hornChain,
  mutate,
  PALETTE_COUNT,
  randomGenome,
  styleFor,
  type Genome,
} from './genome';
import { createInstances, expand } from './horn';
import { demoRng, subSeed } from './rng';
import { createProjected, framing, project, SCREEN_W, type Framing } from './view';

export const MASK_W = 80;
export const MASK_H = 50;
const TIMES = [3, 6, 9] as const;
/** Motion is the mask change over this many seconds. */
const MOTION_DT = 0.4;
const MOTION_TARGET = 0.25;
export const MIN_CHANGE = 0.3;
/** Children scored per new demo, out of at most this many tries. */
const CANDIDATES = 12;
const TRIES = 60;
const ANCESTORS = 3;

const inst = createInstances();
const projected = createProjected(inst.x.length);

/** Occupancy of the ribs at time t (1 = covered). */
export function maskAt(
  g: Genome,
  t: number,
  fr: Framing,
  m: Uint8Array = new Uint8Array(MASK_W * MASK_H),
): Uint8Array {
  m.fill(0);
  expand(g, t, inst);
  const p = project(inst, fr, projected, MASK_W / SCREEN_W).data;
  for (let i = 0; i < projected.count; i++) {
    const cx = p[i * 4] ?? 0,
      cy = p[i * 4 + 1] ?? 0,
      r = Math.max(0.5, p[i * 4 + 3] ?? 0);
    const r2 = r * r;
    const y0 = Math.max(0, Math.floor(cy - r)),
      y1 = Math.min(MASK_H - 1, Math.ceil(cy + r));
    const x0 = Math.max(0, Math.floor(cx - r)),
      x1 = Math.min(MASK_W - 1, Math.ceil(cx + r));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        if (dx * dx + dy * dy <= r2) m[y * MASK_W + x] = 1;
      }
    }
  }
  return m;
}

/**
 * Share of the screen covered, how many of the 16×10 cells the form touches, and its detail:
 * edge pixels per covered pixel (a solid blob is low, tendrils and lace are high).
 */
export function maskStats(m: Uint8Array): { coverage: number; cells: number; detail: number } {
  let n = 0,
    edges = 0;
  const cells = new Uint8Array(160);
  for (let y = 0; y < MASK_H; y++) {
    for (let x = 0; x < MASK_W; x++) {
      const i = y * MASK_W + x;
      if (!m[i]) continue;
      n++;
      cells[Math.floor(x / 5) + 16 * Math.floor(y / 5)] = 1;
      if (x === 0 || y === 0 || x === MASK_W - 1 || y === MASK_H - 1) edges++;
      else if (!m[i - 1] || !m[i + 1] || !m[i - MASK_W] || !m[i + MASK_W]) edges++;
    }
  }
  return {
    coverage: n / m.length,
    cells: cells.reduce((a, b) => a + b, 0),
    detail: edges / Math.max(1, n),
  };
}

/** Changed share of the pixels either mask covers (0 = same picture). */
export function maskDiff(a: Uint8Array, b: Uint8Array): number {
  let union = 0,
    changed = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) {
      union++;
      if (a[i] !== b[i]) changed++;
    }
  }
  return changed / Math.max(1, union);
}

export interface Verdict {
  readonly ok: boolean;
  readonly score: number;
  /** Masks at the three judged moments (for change and novelty). */
  readonly masks: readonly Uint8Array[];
  readonly parts: {
    readonly biggest: number;
    readonly coverage: number;
    readonly cells: number;
    readonly detail: number;
    readonly grain: number;
    readonly motion: number;
  };
}

/** Viable = at each moment it covers 5–55 % of the screen and touches ≥ 22 of 160 cells. */
export function judge(g: Genome, ancestors: readonly (readonly Uint8Array[])[] = []): Verdict {
  const fr = framing(g, inst);
  const masks = TIMES.map((t) => maskAt(g, t, fr));
  const stats = masks.map(maskStats);
  const ok = stats.every((s) => s.coverage >= 0.05 && s.coverage <= 0.55 && s.cells >= 22);
  const later = maskAt(g, (TIMES[0] ?? 3) + MOTION_DT, fr);
  const motion = maskDiff(masks[0] ?? later, later);
  const coverage = stats.reduce((sum, s) => sum + s.coverage, 0) / stats.length;
  const cells = stats.reduce((sum, s) => sum + s.cells, 0) / stats.length;
  const detail = stats.reduce((sum, s) => sum + s.detail, 0) / stats.length;
  const grain = fr.size / fr.r;
  const novelty =
    ancestors.length === 0
      ? 0
      : Math.min(
          ...ancestors.map(
            (a) => masks.reduce((s, m, i) => s + maskDiff(m, a[i] ?? m), 0) / masks.length,
          ),
        );
  const score =
    -3 * Math.abs(coverage - 0.28) +
    cells / 160 +
    1.2 * Math.min(detail, 0.5) -
    12 * Math.max(0, grain - 0.06) -
    6 * Math.max(0, fr.biggest - 0.22) -
    0.4 * Math.min(1, Math.abs(Math.log(Math.max(1e-3, motion) / MOTION_TARGET))) +
    0.6 * novelty;
  return {
    ok,
    score,
    masks,
    parts: { biggest: fr.biggest, coverage, cells, detail, grain, motion },
  };
}

/** How different two pictures look over the judged moments. */
export function change(a: Verdict, b: Verdict): number {
  return a.masks.reduce((s, m, i) => s + maskDiff(m, b.masks[i] ?? m), 0) / a.masks.length;
}

/** The tree's shape: horn kinds from root to tip, copies and mirror. */
const skeleton = (g: Genome) =>
  `${hornChain(g.root)
    .map((h) => h.kind)
    .join('/')}×${g.copies}${g.mirror ? 'm' : ''}`;

/**
 * Per-demo looks from the demo's own seed (the judge cannot see them): the style always, a new
 * palette 40 % of the time (always when the form could not change), a new backdrop 30 %.
 */
function dress(genome: Genome, seed: number, stuck: boolean): void {
  const r = demoRng(subSeed(seed, 0xd2e55));
  genome.style = styleFor(seed);
  if (stuck || r.chance(0.4))
    genome.palette = (genome.palette + r.int(1, PALETTE_COUNT - 1)) % PALETTE_COUNT;
  if (r.chance(0.3)) genome.backdrop = genome.backdrop === 'bars' ? 'stars' : 'bars';
}

export interface Judged {
  readonly genome: Genome;
  readonly verdict: Verdict;
}

/** The first demo: draws from the seed until one is viable (else a known-good spring). */
export function firstDemo(seed: number): Judged {
  for (let attempt = 0; attempt < 30; attempt++) {
    const genome = randomGenome(subSeed(seed, attempt));
    const verdict = judge(genome);
    if (verdict.ok) {
      dress(genome, seed, false);
      return { genome, verdict };
    }
  }
  const genome = fallbackGenome();
  return { genome, verdict: judge(genome) };
}

export interface Candidate extends Judged {
  readonly ops: readonly string[];
  readonly change: number;
}

/** Up to `CANDIDATES` viable, visibly different, not merely recoloured children. */
export function candidates(
  parent: Judged,
  seed: number,
  ancestors: readonly (readonly Uint8Array[])[] = [],
  wanted = CANDIDATES,
): Candidate[] {
  const out: Candidate[] = [];
  for (let attempt = 0; attempt < TRIES && out.length < wanted; attempt++) {
    const m = mutate(parent.genome, subSeed(seed, attempt));
    if (!m || m.ops.every((op) => COSMETIC.has(op))) continue;
    const verdict = judge(m.genome, ancestors);
    if (!verdict.ok) continue;
    const c = change(parent.verdict, verdict);
    if (c < MIN_CHANGE) continue;
    out.push({ genome: m.genome, verdict, ops: m.ops, change: c });
  }
  return out;
}

/** The next demo after `parent` (the parent again, recoloured, if no child qualifies). */
export function nextDemo(
  parent: Judged,
  seed: number,
  ancestors: readonly (readonly Uint8Array[])[] = [],
): Judged {
  let best: Candidate | null = null;
  let bestScore = -Infinity;
  for (const c of candidates(parent, seed, ancestors)) {
    // a new shape of tree (another family, an arrangement more or less, other copies) is worth
    // a little: lineages should wander, not polish one blob
    const score = c.verdict.score + (skeleton(c.genome) !== skeleton(parent.genome) ? 0.15 : 0);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  const genome = best ? cloneGenome(best.genome) : cloneGenome(parent.genome);
  dress(genome, seed, !best);
  return { genome, verdict: best?.verdict ?? parent.verdict };
}

// ---- lineages: demo n is the judge's pick after demo n−1 ----

const cache = new Map<string, Judged>();
const CACHE_LIMIT = 128;

/**
 * Replays a lineage one demo per `next()` (the UI shows it as "depacking"), memoised by seed
 * prefix; the value when done is the last demo's genome.
 */
export function* lineage(seeds: readonly number[]): Generator<number, Genome, void> {
  const chain: Judged[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const key = seeds.slice(0, i + 1).join(',');
    let judged = cache.get(key);
    if (!judged) {
      const seed = seeds[i] ?? 0;
      const parent = chain[i - 1];
      const ancestors = chain.slice(Math.max(0, i - ANCESTORS), i).map((j) => j.verdict.masks);
      judged = parent ? nextDemo(parent, seed, ancestors) : firstDemo(seed);
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value ?? '');
      cache.set(key, judged);
      yield (i + 1) / seeds.length;
    }
    chain.push(judged);
  }
  return chain.at(-1)?.genome ?? fallbackGenome();
}

/** The whole lineage at once (tests, the dev page). */
export function genomeOf(seeds: readonly number[]): Genome {
  const it = lineage(seeds);
  for (;;) {
    const step = it.next();
    if (step.done) return step.value;
  }
}
