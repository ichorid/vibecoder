/** Shelf packer: places animation strips (frames side by side) into a power-of-two sheet. */
export interface PackItem {
  readonly id: string;
  readonly w: number;
  readonly h: number;
}

export interface Placed extends PackItem {
  readonly x: number;
  readonly y: number;
}

export function pack(
  items: readonly PackItem[],
  maxSize = 2048,
  gap = 1,
): { size: { w: number; h: number }; placed: Placed[] } {
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w || a.id.localeCompare(b.id));
  for (let width = 64; width <= maxSize; width *= 2) {
    const placed: Placed[] = [];
    let x = 0;
    let y = 0;
    let shelf = 0;
    let fits = true;
    for (const item of sorted) {
      if (item.w > width) {
        fits = false;
        break;
      }
      if (x + item.w > width) {
        x = 0;
        y += shelf + gap;
        shelf = 0;
      }
      placed.push({ ...item, x, y });
      x += item.w + gap;
      shelf = Math.max(shelf, item.h);
    }
    const used = y + shelf;
    let height = 1;
    while (height < used) height *= 2;
    if (fits && height <= width) return { size: { w: width, h: height }, placed };
  }
  throw new Error('sprites do not fit in the maximum atlas size');
}
