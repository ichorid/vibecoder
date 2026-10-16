/**
 * Minimal RGBA pixel canvas for authoring pixel art in code. Hard pixels only: no blending,
 * no anti-aliasing. Everything outside the bounds is clipped.
 */
export type Rgba = readonly [number, number, number, number];
export type Color = string | Rgba;

export interface PixelCanvas {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
  get(x: number, y: number): number[];
  set(x: number, y: number, color: Color): void;
  rect(x: number, y: number, w: number, h: number, color: Color): void;
  /** One-pixel outline of a rectangle. */
  frame(x: number, y: number, w: number, h: number, color: Color): void;
  line(x0: number, y0: number, x1: number, y1: number, color: Color): void;
  /** Filled disc (pixel-art circle). */
  disc(cx: number, cy: number, r: number, color: Color): void;
  /** Checkerboard dither of two colors inside a rectangle. */
  dither(x: number, y: number, w: number, h: number, a: Color, b: Color): void;
  /** Draw a text pixel map; '.' and ' ' are transparent. `scale` repeats pixels. */
  map(
    rows: readonly string[],
    palette: Readonly<Record<string, Color>>,
    x: number,
    y: number,
    scale?: number,
  ): void;
  /** Copy opaque pixels of another canvas (alpha > 0) at an offset. */
  blit(source: PixelCanvas, x: number, y: number): void;
}

const cache = new Map<string, Rgba>();

export function parseColor(color: Color): Rgba {
  if (typeof color !== 'string') return color;
  const known = cache.get(color);
  if (known) return known;
  const hex = color.replace('#', '');
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) throw new Error(`bad color ${color}`);
  const rgba: Rgba = [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
    hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255,
  ];
  cache.set(color, rgba);
  return rgba;
}

export function createCanvas(width: number, height: number): PixelCanvas {
  const data = new Uint8ClampedArray(width * height * 4);

  const set = (x: number, y: number, color: Color) => {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= width || py >= height) return;
    const [r, g, b, a] = parseColor(color);
    const i = (py * width + px) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  };

  const rect = (x: number, y: number, w: number, h: number, color: Color) => {
    for (let yy = Math.max(0, y); yy < Math.min(height, y + h); yy += 1) {
      for (let xx = Math.max(0, x); xx < Math.min(width, x + w); xx += 1) set(xx, yy, color);
    }
  };

  const canvas: PixelCanvas = {
    width,
    height,
    data,
    get(x, y) {
      const i = (y * width + x) * 4;
      return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, data[i + 3] ?? 0];
    },
    set,
    rect,
    frame(x, y, w, h, color) {
      rect(x, y, w, 1, color);
      rect(x, y + h - 1, w, 1, color);
      rect(x, y, 1, h, color);
      rect(x + w - 1, y, 1, h, color);
    },
    line(x0, y0, x1, y1, color) {
      let x = Math.round(x0);
      let y = Math.round(y0);
      const tx = Math.round(x1);
      const ty = Math.round(y1);
      const dx = Math.abs(tx - x);
      const dy = -Math.abs(ty - y);
      const sx = x < tx ? 1 : -1;
      const sy = y < ty ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        set(x, y, color);
        if (x === tx && y === ty) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y += sy;
        }
      }
    },
    disc(cx, cy, r, color) {
      for (let y = -r; y <= r; y += 1) {
        for (let x = -r; x <= r; x += 1) {
          if (x * x + y * y <= r * r + r * 0.8) set(cx + x, cy + y, color);
        }
      }
    },
    dither(x, y, w, h, a, b) {
      for (let yy = y; yy < y + h; yy += 1) {
        for (let xx = x; xx < x + w; xx += 1) set(xx, yy, (xx + yy) % 2 === 0 ? a : b);
      }
    },
    map(rows, palette, x, y, scale = 1) {
      rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx += 1) {
          const key = row[rx] ?? '.';
          if (key === '.' || key === ' ') continue;
          const color = palette[key];
          if (color === undefined) throw new Error(`palette has no "${key}"`);
          rect(x + rx * scale, y + ry * scale, scale, scale, color);
        }
      });
    },
    blit(source, x, y) {
      for (let sy = 0; sy < source.height; sy += 1) {
        for (let sx = 0; sx < source.width; sx += 1) {
          const i = (sy * source.width + sx) * 4;
          const alpha = source.data[i + 3] ?? 0;
          if (alpha === 0) continue;
          set(x + sx, y + sy, [
            source.data[i] ?? 0,
            source.data[i + 1] ?? 0,
            source.data[i + 2] ?? 0,
            alpha,
          ]);
        }
      }
    },
  };
  return canvas;
}
