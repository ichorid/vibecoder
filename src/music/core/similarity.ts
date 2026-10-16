/**
 * Similarity between patterns of one bank, for composers and reviewers (S06.1). Exact
 * duplicates compare a normalized fingerprint (clock + sorted events; ids, energy, boundary
 * labels and metadata ignored). Near variants need all three readable features to agree:
 * rhythm (onset-step Jaccard), pitch-class distribution (length-weighted cosine) and melodic
 * contour of the top voice. A shared motif alone is never enough. O(n²) pairs — fine for ~60.
 */
import { canonicalJson } from './canonical';
import type { NormalizedPattern } from './validation';

export interface SimilarityFinding {
  readonly a: string;
  readonly b: string;
  readonly kind: 'exact' | 'near';
  readonly reason: string;
}

/** Thresholds for a "near" finding (all must hold). */
export const NEAR = { rhythm: 0.85, pitchClasses: 0.95, contour: 0.8 } as const;

const key = (p: NormalizedPattern) => `${p.id}@${p.revision}`;

function fingerprint(p: NormalizedPattern): string {
  const events = [...p.events]
    .map(
      (e) => [e.role, e.step, e.length, e.type, e.midi ?? -1, e.sound ?? '', e.velocity] as const,
    )
    .sort((x, y) => {
      for (let i = 0; i < x.length; i += 1) {
        const a = x[i] ?? 0;
        const b = y[i] ?? 0;
        if (a < b) return -1;
        if (a > b) return 1;
      }
      return 0;
    });
  return canonicalJson({
    clock: [p.bpm, p.bars, p.stepsPerBar, p.timeSignature.numerator, p.timeSignature.denominator],
    events,
  });
}

function rhythm(a: NormalizedPattern, b: NormalizedPattern): number {
  const onsets = (p: NormalizedPattern) => new Set(p.events.map((e) => e.step));
  const x = onsets(a);
  const y = onsets(b);
  const shared = [...x].filter((s) => y.has(s)).length;
  const union = new Set([...x, ...y]).size;
  return union === 0 ? 1 : shared / union;
}

function pitchClasses(a: NormalizedPattern, b: NormalizedPattern): number {
  const histogram = (p: NormalizedPattern) => {
    const h = new Array<number>(12).fill(0);
    for (const e of p.events)
      if (e.midi !== null) h[e.midi % 12] = (h[e.midi % 12] ?? 0) + e.length;
    return h;
  };
  const x = histogram(a);
  const y = histogram(b);
  const dot = x.reduce((s, v, i) => s + v * (y[i] ?? 0), 0);
  const norm = (h: number[]) => Math.sqrt(h.reduce((s, v) => s + v * v, 0));
  const n = norm(x) * norm(y);
  return n === 0 ? (norm(x) === norm(y) ? 1 : 0) : dot / n;
}

/** Up/down/same steps of the highest note at each onset. */
function contourOf(p: NormalizedPattern): number[] {
  const top = new Map<number, number>();
  for (const e of p.events) {
    if (e.midi === null) continue;
    top.set(e.step, Math.max(top.get(e.step) ?? -Infinity, e.midi));
  }
  const pitches = [...top.entries()].sort((x, y) => x[0] - y[0]).map(([, m]) => m);
  return pitches.slice(1).map((m, i) => Math.sign(m - (pitches[i] ?? m)));
}

function contour(a: NormalizedPattern, b: NormalizedPattern): number {
  const x = contourOf(a);
  const y = contourOf(b);
  const length = Math.max(x.length, y.length);
  if (length === 0) return 1;
  let same = 0;
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) if (x[i] === y[i]) same += 1;
  return same / length;
}

export function comparePatterns(
  a: NormalizedPattern,
  b: NormalizedPattern,
): Omit<SimilarityFinding, 'a' | 'b'> | null {
  if (fingerprint(a) === fingerprint(b)) {
    return { kind: 'exact', reason: 'identical music after normalization' };
  }
  const r = rhythm(a, b);
  const pc = pitchClasses(a, b);
  const c = contour(a, b);
  if (r >= NEAR.rhythm && pc >= NEAR.pitchClasses && c >= NEAR.contour) {
    return {
      kind: 'near',
      reason: `near variant: rhythm ${r.toFixed(2)}, pitch classes ${pc.toFixed(2)}, contour ${c.toFixed(2)}`,
    };
  }
  return null;
}

/** All findings within one set of patterns, sorted by pair keys (deterministic). */
export function compareBank(patterns: readonly NormalizedPattern[]): SimilarityFinding[] {
  const sorted = [...patterns].sort((x, y) => key(x).localeCompare(key(y)));
  const findings: SimilarityFinding[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i];
      const b = sorted[j];
      if (!a || !b) continue;
      const found = comparePatterns(a, b);
      if (found) findings.push({ a: key(a), b: key(b), ...found });
    }
  }
  return findings;
}
