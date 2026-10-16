/**
 * Cosmetic cat movement between spots: walk along the current level, and change level with a
 * jump (onto or off a raised surface such as the desk) instead of walking through the air.
 */
export interface Point2 {
  readonly x: number;
  readonly y: number;
}

/** A raised surface the cat can stand on, e.g. the desk top (feet y and walkable x range). */
export interface Surface {
  readonly y: number;
  readonly minX: number;
  readonly maxX: number;
}

export type PathStep =
  | { readonly kind: 'walk'; readonly to: Point2 }
  | { readonly kind: 'jump'; readonly from: Point2; readonly to: Point2 };

/** Level changes larger than this are jumps. */
const SAME_LEVEL = 12;

const surfaceAt = (p: Point2, surfaces: readonly Surface[]) =>
  surfaces.find((s) => Math.abs(s.y - p.y) <= 2 && p.x >= s.minX - 1 && p.x <= s.maxX + 1);

export function planCatPath(from: Point2, to: Point2, surfaces: readonly Surface[]): PathStep[] {
  if (Math.abs(to.y - from.y) <= SAME_LEVEL) return [{ kind: 'walk', to }];
  // Walk along the current level to a take-off point: on a surface, never past its edges.
  const surface = surfaceAt(from, surfaces);
  const x = surface ? Math.min(surface.maxX, Math.max(surface.minX, to.x)) : to.x;
  const takeOff = { x, y: from.y };
  const steps: PathStep[] = [];
  if (Math.abs(takeOff.x - from.x) > 0.5) steps.push({ kind: 'walk', to: takeOff });
  steps.push({ kind: 'jump', from: takeOff, to });
  return steps;
}

/** Height of a hop's arc above its higher end, in world pixels. */
export const HOP_HEIGHT = 10;

/** Position along a hop at progress t (0–1): straight horizontally, a parabola vertically. */
export function hopPosition(from: Point2, to: Point2, t: number): Point2 {
  const k = Math.min(1, Math.max(0, t));
  if (k === 0) return from;
  if (k === 1) return to;
  const top = Math.min(from.y, to.y) - HOP_HEIGHT;
  // Quadratic Bézier through a control point above the higher end.
  const cy = 2 * top - (from.y + to.y) / 2;
  const y = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * cy + k * k * to.y;
  return { x: from.x + (to.x - from.x) * k, y };
}
