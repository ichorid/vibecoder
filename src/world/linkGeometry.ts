/** Where connectors meet a cluster drawn as a picture (pure). */
export interface Pt {
  readonly x: number;
  readonly y: number;
}
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * The point where the segment from `from` to `to` first enters `box` (when `to` lies inside it),
 * so a connector stops at the picture's border instead of running across it. Unchanged when
 * `to` is outside the box or `from` is already inside.
 */
export function clipToBox(from: Pt, to: Pt, box: Box): Pt {
  const inside = (p: Pt) =>
    p.x > box.x && p.x < box.x + box.w && p.y > box.y && p.y < box.y + box.h;
  if (!inside(to) || inside(from)) return to;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let t = 1;
  const candidates: number[] = [];
  if (dx !== 0) candidates.push((box.x - from.x) / dx, (box.x + box.w - from.x) / dx);
  if (dy !== 0) candidates.push((box.y - from.y) / dy, (box.y + box.h - from.y) / dy);
  for (const c of candidates) {
    if (c < 0 || c > 1) continue;
    const p = { x: from.x + dx * c, y: from.y + dy * c };
    const onEdge =
      p.x >= box.x - 1e-9 &&
      p.x <= box.x + box.w + 1e-9 &&
      p.y >= box.y - 1e-9 &&
      p.y <= box.y + box.h + 1e-9;
    if (onEdge) t = Math.min(t, c);
  }
  return { x: from.x + dx * t, y: from.y + dy * t };
}
