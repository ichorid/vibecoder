import { describe, expect, it } from 'vitest';
import { pack } from './pack';

describe('shelf packer', () => {
  it('places items without overlap inside a power-of-two sheet', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      id: `s${i}`,
      w: 10 + (i % 7) * 9,
      h: 8 + (i % 5) * 7,
    }));
    const { size, placed } = pack(items);
    expect(Math.log2(size.w) % 1).toBe(0);
    expect(Math.log2(size.h) % 1).toBe(0);
    for (const a of placed) {
      expect(a.x + a.w).toBeLessThanOrEqual(size.w);
      expect(a.y + a.h).toBeLessThanOrEqual(size.h);
      for (const b of placed) {
        if (a === b) continue;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    }
  });

  it('is deterministic', () => {
    const items = [
      { id: 'a', w: 5, h: 5 },
      { id: 'b', w: 5, h: 5 },
    ];
    expect(pack(items)).toEqual(pack(items));
  });
});
