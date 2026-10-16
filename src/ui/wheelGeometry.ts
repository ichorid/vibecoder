/**
 * Release wheel geometry (pure). Angles are degrees clockwise from the pointer at the top. The
 * gold slice is drawn at its true size (hazard × 360°) and the silly slices share the rest
 * equally, so nothing is drawn larger than its odds. The landing point is presentation only.
 */
import { deriveSeed, nextFloat, nextInt } from '../game/random';

export interface Arc {
  readonly start: number;
  readonly end: number;
}

/** `count` equal slices, then the gold slice last. */
export function sliceArcs(count: number, hazard: number): Arc[] {
  const gold = Math.min(360, Math.max(0, hazard * 360));
  const each = (360 - gold) / count;
  const arcs: Arc[] = [];
  for (let i = 0; i < count; i += 1) arcs.push({ start: i * each, end: (i + 1) * each });
  arcs.push({ start: 360 - gold, end: 360 });
  return arcs;
}

/** Slices narrower than this land exactly at their centre. */
export const CENTRE_BELOW_DEG = 6;

/** Where on the wheel the pointer will rest: inside the target, away from its edges. */
export function landingAngle(arcs: readonly Arc[], target: number, seed: number): number {
  const arc = arcs[target];
  if (!arc) return 0;
  const width = arc.end - arc.start;
  const centre = arc.start + width / 2;
  if (width < CENTRE_BELOW_DEG) return centre;
  // Within the middle 40 % of the slice: never on an edge, never a staged near miss.
  const offset = nextFloat(deriveSeed(seed, 'landing')).value - 0.5;
  return centre + offset * width * 0.4;
}

/** Total clockwise rotation that brings `landing` under the pointer after 4–6 full turns. */
export function spinRotation(landing: number, seed: number): number {
  const turns = nextInt(deriveSeed(seed, 'turns'), 4, 6).value;
  return turns * 360 + ((360 - landing) % 360);
}

/** Ease-out (cubic) rotation at progress 0–1. */
export function rotationAt(total: number, progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  return total * (1 - (1 - t) ** 3);
}

/** How many slice boundaries passed under the pointer between two rotations. */
export function boundariesCrossed(arcs: readonly Arc[], from: number, to: number): number {
  let crossed = 0;
  const starts = arcs.map((a) => a.start);
  for (const start of starts) {
    // The pointer reads the wheel at angle (360 − rotation); a boundary at `start` passes when
    // the rotation goes through (360 − start) + k·360.
    const at = (360 - start) % 360;
    const first = Math.ceil((from - at) / 360);
    const last = Math.floor((to - at) / 360);
    if (to > from) crossed += Math.max(0, last - first + 1 - (from === at + first * 360 ? 1 : 0));
  }
  return crossed;
}

/** SVG path for an annular sector of radius r around (cx, cy). */
export function sectorPath(arc: Arc, cx: number, cy: number, r: number): string {
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(rad)).toFixed(3)} ${(cy + r * Math.sin(rad)).toFixed(3)}`;
  };
  const large = arc.end - arc.start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${point(arc.start)} A ${r} ${r} 0 ${large} 1 ${point(arc.end)} Z`;
}
