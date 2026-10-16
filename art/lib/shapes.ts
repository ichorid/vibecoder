/** Shape helpers on top of PixelCanvas: ellipses, triangles, auto-outline, shading. */
import { parseColor, type Color, type PixelCanvas } from './canvas';

export function ellipse(
  c: PixelCanvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: Color,
): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const dx = (x - cx) / (rx + 0.5);
      const dy = (y - cy) / (ry + 0.5);
      if (dx * dx + dy * dy <= 1) c.set(x, y, color);
    }
  }
}

type Point = readonly [number, number];

export function triangle(c: PixelCanvas, a: Point, b: Point, p: Point, color: Color): void {
  const minX = Math.floor(Math.min(a[0], b[0], p[0]));
  const maxX = Math.ceil(Math.max(a[0], b[0], p[0]));
  const minY = Math.floor(Math.min(a[1], b[1], p[1]));
  const maxY = Math.ceil(Math.max(a[1], b[1], p[1]));
  const area = (u: Point, v: Point, w: Point) =>
    (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
  const total = area(a, b, p);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const q: Point = [x, y];
      const w0 = area(b, p, q);
      const w1 = area(p, a, q);
      const w2 = area(a, b, q);
      const inside =
        total >= 0
          ? w0 >= -0.01 && w1 >= -0.01 && w2 >= -0.01
          : w0 <= 0.01 && w1 <= 0.01 && w2 <= 0.01;
      if (inside) c.set(x, y, color);
    }
  }
  c.set(a[0], a[1], color);
  c.set(b[0], b[1], color);
  c.set(p[0], p[1], color);
}

/** Thick polyline: a disc of radius `r` stamped along each segment. */
export function stroke(c: PixelCanvas, points: readonly Point[], r: number, color: Color): void {
  for (let i = 0; i + 1 < points.length; i += 1) {
    const [x0, y0] = points[i] ?? [0, 0];
    const [x1, y1] = points[i + 1] ?? [0, 0];
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let s = 0; s <= steps; s += 1) {
      const x = x0 + ((x1 - x0) * s) / steps;
      const y = y0 + ((y1 - y0) * s) / steps;
      if (r <= 0) c.set(x, y, color);
      else c.disc(Math.round(x), Math.round(y), r, color);
    }
  }
}

/** Give every transparent pixel orthogonally adjacent to an opaque one the outline color. */
export function outline(c: PixelCanvas, color: Color): void {
  const [r, g, b, a] = parseColor(color);
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < c.width && y < c.height && (c.data[(y * c.width + x) * 4 + 3] ?? 0) > 0;
  const marks: number[] = [];
  for (let y = 0; y < c.height; y += 1) {
    for (let x = 0; x < c.width; x += 1) {
      if (opaque(x, y)) continue;
      if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) {
        marks.push(x, y);
      }
    }
  }
  for (let i = 0; i < marks.length; i += 2) c.set(marks[i] ?? 0, marks[i + 1] ?? 0, [r, g, b, a]);
}

/** Replace one exact color with another inside a rectangle (for shading passes). */
export function recolor(
  c: PixelCanvas,
  from: Color,
  to: Color,
  x = 0,
  y = 0,
  w = c.width,
  h = c.height,
): void {
  const [fr, fg, fb, fa] = parseColor(from);
  for (let yy = Math.max(0, y); yy < Math.min(c.height, y + h); yy += 1) {
    for (let xx = Math.max(0, x); xx < Math.min(c.width, x + w); xx += 1) {
      const i = (yy * c.width + xx) * 4;
      if (
        c.data[i] === fr &&
        c.data[i + 1] === fg &&
        c.data[i + 2] === fb &&
        c.data[i + 3] === fa
      ) {
        c.set(xx, yy, to);
      }
    }
  }
}
