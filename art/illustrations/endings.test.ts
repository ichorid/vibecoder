import { describe, expect, it } from 'vitest';
import { parseColor } from '../lib/canvas';
import { light } from '../palette';
import { catSprites } from '../sprites/cat';
import { infiniteWeekend, WEEKEND_CAT } from './endings';

const CAT_COLORS = [light.cat, light.catDark, light.catLight, light.catWhite, light.catNose].map(
  (c) => parseColor(c).slice(0, 3).join(','),
);

function pixels(canvas: ReturnType<typeof infiniteWeekend>): string[] {
  const out: string[] = [];
  for (let i = 0; i < canvas.data.length; i += 4) {
    out.push(`${canvas.data[i]},${canvas.data[i + 1]},${canvas.data[i + 2]}`);
  }
  return out;
}

describe('The Infinite Weekend picture', () => {
  const withCat = infiniteWeekend(true);
  const noCat = infiniteWeekend(false);

  it('has no cat at all without the cat, and the cat with it', () => {
    expect(pixels(noCat).some((p) => CAT_COLORS.includes(p))).toBe(false);
    expect(pixels(withCat).some((p) => CAT_COLORS.includes(p))).toBe(true);
  });

  it('is the same scene outside the cat layer', () => {
    const frame = catSprites(light).find((s) => s.tag === 'cat-sleep')?.frames[0];
    if (!frame) throw new Error('no cat-sleep frame');
    const a = pixels(withCat);
    const b = pixels(noCat);
    for (let y = 0; y < withCat.height; y += 1) {
      for (let x = 0; x < withCat.width; x += 1) {
        const inside =
          x >= WEEKEND_CAT.x &&
          x < WEEKEND_CAT.x + frame.width &&
          y >= WEEKEND_CAT.y &&
          y < WEEKEND_CAT.y + frame.height;
        if (!inside) expect(a[y * withCat.width + x], `${x},${y}`).toBe(b[y * withCat.width + x]);
      }
    }
  });
});
