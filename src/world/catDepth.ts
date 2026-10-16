import type { Placement } from '../content/world';

/** Whether a placement is drawn over the world cat whose feet are at `catFeetY`. */
export function coversCat(placement: Placement, catFeetY: number): boolean {
  return placement.coversCatAbove !== undefined && catFeetY < placement.coversCatAbove;
}
