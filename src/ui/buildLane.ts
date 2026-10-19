/**
 * The build lane's presentation state (docs/feature_build_deck.md §6.3–§6.5): an order the
 * thumb can learn. It changes only by a swap in place, an insert at the peek position, or a
 * removal — never by re-sorting.
 */

/** Movement (px) that turns a press on the lane into a scroll. */
export const TAP_SLOP_PX = 10;
/** Auto-scroll waits this long after the player last touched or scrolled the lane. */
export const AIM_HOLD_MS = 1000;
/** Arrivals come one at a time, this far apart. */
export const ARRIVAL_GAP_MS = 700;
/** Items an auto-scroll just moved ignore taps this long. */
export const MOVED_INERT_MS = 300;
/** Expanded cards and the ready popup ignore taps this long after they appear. */
export const APPEAR_INERT_MS = 400;
/** NEW stays until the item has been fully visible this long (or is tapped). */
export const NEW_SEEN_MS = 1500;

/**
 * Bring the lane's order in line with the items present now. Kept items stay in their order;
 * `place` puts a returning item at a given index (the swap in place); other new items go in
 * at `insertAt` (clamped), in the model's order. `order` null: the first render, nothing new.
 */
export function reconcileLane(
  order: readonly string[] | null,
  present: readonly string[],
  insertAt: number,
  place: ReadonlyMap<string, number> = new Map(),
): { order: string[]; added: string[] } {
  if (order === null) return { order: [...present], added: [] };
  const here = new Set(present);
  const next = order.filter((key) => here.has(key));
  const known = new Set(next);
  const added = present.filter((key) => !known.has(key));
  const placed = added
    .filter((key) => place.has(key))
    .sort((a, b) => (place.get(a) ?? 0) - (place.get(b) ?? 0));
  for (const key of placed) {
    next.splice(Math.min(Math.max(0, place.get(key) ?? 0), next.length), 0, key);
  }
  let at = Math.min(Math.max(0, insertAt), next.length);
  for (const key of added) {
    if (place.has(key)) continue;
    next.splice(at, 0, key);
    at += 1;
  }
  return { order: next, added };
}

/** The first item whose right edge is past the visible right edge (the end if all fit). */
export function peekIndex(itemRights: readonly number[], viewRight: number): number {
  const index = itemRights.findIndex((right) => right > viewRight + 0.5);
  return index < 0 ? itemRights.length : index;
}

export interface AimState {
  readonly pressing: boolean;
  readonly lastTouchMs: number;
  readonly lastArrivalMs: number;
}

/** Whether the next arrival may scroll the lane now. */
export function arrivalReady(state: AimState, nowMs: number): boolean {
  return (
    !state.pressing &&
    nowMs - state.lastTouchMs >= AIM_HOLD_MS &&
    nowMs - state.lastArrivalMs >= ARRIVAL_GAP_MS
  );
}

/** A press that moved less than the slop is a tap; anything more is a scroll. */
export function isTap(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) < TAP_SLOP_PX;
}
