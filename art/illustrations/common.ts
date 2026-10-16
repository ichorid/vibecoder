/** Shared helpers for 128×96 technology illustrations and memorial photos. */
import { createCanvas, type Color, type PixelCanvas } from '../lib/canvas';
import { outline } from '../lib/shapes';
import { light, type Palette } from '../palette';
import { MOTIFS } from '../sprites/kit';

export const ILLUSTRATION = { w: 128, h: 96 } as const;
export type Illustration = (c: PixelCanvas, p: Palette) => void;

/** Backdrop: two-tone wall with a dithered seam, like the room. */
export function backdrop(c: PixelCanvas, top: Color, bottom: Color, seamY = 66): void {
  c.rect(0, 0, c.width, c.height, top);
  c.rect(0, seamY, c.width, c.height - seamY, bottom);
  c.dither(0, seamY - 2, c.width, 2, top, bottom);
}

/** Blit a kit motif (frame 0), scaled by an integer factor. */
export function motif(
  c: PixelCanvas,
  id: string,
  x: number,
  y: number,
  scale = 1,
  p: Palette = light,
  frame = 0,
): void {
  const definition = MOTIFS.find((m) => m.id === id);
  if (!definition) throw new Error(`unknown motif ${id}`);
  const sprite = createCanvas(definition.w, definition.h);
  definition.draw(sprite, p, frame);
  outline(sprite, p.outline);
  blitScaled(c, sprite, x, y, scale);
}

export function blitScaled(
  c: PixelCanvas,
  sprite: PixelCanvas,
  x: number,
  y: number,
  scale: number,
): void {
  for (let sy = 0; sy < sprite.height; sy += 1) {
    for (let sx = 0; sx < sprite.width; sx += 1) {
      const px = sprite.get(sx, sy);
      if ((px[3] ?? 0) === 0) continue;
      c.rect(x + sx * scale, y + sy * scale, scale, scale, [
        px[0] ?? 0,
        px[1] ?? 0,
        px[2] ?? 0,
        px[3] ?? 255,
      ]);
    }
  }
}

/** A code line made of colored tokens. */
export function codeLine(
  c: PixelCanvas,
  x: number,
  y: number,
  widths: readonly number[],
  colors: readonly Color[],
): void {
  let cx = x;
  widths.forEach((w, i) => {
    c.rect(cx, y, w, 2, colors[i % colors.length] ?? '#ffffff');
    cx += w + 2;
  });
}

/** Little four-point sparkle. */
export function sparkle(c: PixelCanvas, x: number, y: number, color: Color): void {
  c.set(x, y, color);
  c.set(x - 1, y, color);
  c.set(x + 1, y, color);
  c.set(x, y - 1, color);
  c.set(x, y + 1, color);
  c.set(x, y - 2, color);
  c.set(x, y + 2, color);
}
