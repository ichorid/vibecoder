/**
 * The demo rasterizer: an indexed 160×100 framebuffer drawn with demoscene tricks
 * (docs/feature_demo.md §Speed): pre-shaded ball sprites ("vector bobs") with a 1-pixel
 * outline, a counting sort over 256 depth slots, a screen-space 4×4 Bayer dither, depth fog,
 * palette-index trails, copper bars or a parallax starfield, and a vector-line style.
 */
import type { Genome } from './genome';
import { createInstances, expand } from './horn';
import { paletteRgba } from './palettes';
import { spriteFor, turns } from './sprites';
import { createProjected, framing, project, SCREEN_H, SCREEN_W, type Framing } from './view';

const W = SCREEN_W;
const H = SCREEN_H;
const BAYER = Uint8Array.from(
  [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5],
  (x) => x * 16 + 8,
);
const RAMP = [2, 7, 12] as const;

export interface DemoCanvas {
  readonly buf: Uint8Array;
  readonly rgba: Uint32Array;
  /** Frames drawn so far (trails fade on a frame cadence). */
  frame: number;
  readonly fr: Framing;
  readonly genome: Genome;
}

const inst = createInstances();
const projected = createProjected(inst.x.length);
const order = new Uint16Array(inst.x.length);
const buckets = new Uint32Array(257);

export function createDemoCanvas(genome: Genome): DemoCanvas {
  return {
    buf: new Uint8Array(W * H),
    rgba: new Uint32Array(W * H),
    frame: 0,
    fr: framing(genome, inst),
    genome,
  };
}

function backdropRow(g: Genome, y: number, t: number): number {
  if (g.backdrop === 'stars') return 0;
  const bar =
    Math.abs(Math.sin(y * 0.07 + t * 0.9)) > 0.985 ||
    Math.abs(Math.sin(y * 0.045 - t * 0.6)) > 0.99;
  return bar ? 1 : 0;
}

function stars(buf: Uint8Array, g: Genome, t: number): void {
  // Three parallax layers drifting left; positions are fixed by the genome's phases.
  const seed = Math.floor((g.phase[0] ?? 0) * 1e6);
  for (let i = 0; i < 70; i++) {
    const h1 = Math.sin(i * 12.9898 + seed) * 43758.5453;
    const h2 = Math.sin(i * 78.233 + seed) * 12345.6789;
    const layer = i % 3;
    const x0 = (h1 - Math.floor(h1)) * W;
    const y = Math.floor((h2 - Math.floor(h2)) * H);
    const x = Math.floor((((x0 - t * (layer + 1) * 7) % W) + W) % W);
    buf[y * W + x] = layer === 2 ? 17 : layer === 1 ? 14 : 1;
  }
}

/** Sort the projected ribs far → near by counting sort over 256 depth slots. */
function sortFarToNear(n: number): void {
  const p = projected.data;
  const span = Math.max(1e-6, projected.zmax - projected.zmin);
  const zs = 255.99 / span;
  buckets.fill(0);
  for (let i = 0; i < n; i++) {
    const slot = 256 - Math.floor(((p[i * 4 + 2] ?? 0) - projected.zmin) * zs);
    buckets[slot] = (buckets[slot] ?? 0) + 1;
  }
  for (let b = 1; b < 257; b++) buckets[b] = (buckets[b] ?? 0) + (buckets[b - 1] ?? 0);
  for (let i = n - 1; i >= 0; i--) {
    const slot = 256 - Math.floor(((p[i * 4 + 2] ?? 0) - projected.zmin) * zs);
    const at = (buckets[slot] ?? 1) - 1;
    buckets[slot] = at;
    order[at] = i;
  }
}

/** 0 at the back, 1 at the front. */
const nearness = (z: number) =>
  1 - (z - projected.zmin) / Math.max(1e-6, projected.zmax - projected.zmin);

function drawBobs(buf: Uint8Array, n: number): void {
  const p = projected.data;
  for (let q = 0; q < n; q++) {
    const i = order[q] ?? 0;
    if (!((inst.glow[i] ?? 1) > 0)) continue; // a hidden rib
    const o = i * 4;
    const shape = inst.shape[i] ?? 0;
    // shapes that are not round turn along their tube on screen
    let angle = 0;
    if (turns(shape)) {
      const before = i > 0 && inst.chain[i - 1] === inst.chain[i] ? i - 1 : i;
      const after = i + 1 < n && inst.chain[i + 1] === inst.chain[i] ? i + 1 : i;
      if (before !== after) {
        angle = Math.atan2(
          (p[before * 4 + 1] ?? 0) - (p[after * 4 + 1] ?? 0),
          (p[after * 4] ?? 0) - (p[before * 4] ?? 0),
        );
      }
    }
    const sprite = spriteFor(shape, p[o + 3] ?? 0, angle);
    const x0 = Math.round((p[o] ?? 0) - sprite.c);
    const y0 = Math.round((p[o + 1] ?? 0) - sprite.c);
    // depth fog: the back of the form is up to ~45 % darker
    const fog = Math.round((140 + 116 * nearness(p[o + 2] ?? 3)) * (inst.glow[i] ?? 1));
    const ramp = RAMP[inst.tone[i] ?? 0] ?? 2;
    const { d, light, mask } = sprite;
    for (let y = 0; y < d; y++) {
      const sy = y0 + y;
      if (sy < 0 || sy >= H) continue;
      const row = (sy & 3) * 4;
      for (let x = 0; x < d; x++) {
        const sx = x0 + x;
        const si = y * d + x;
        if (sx < 0 || sx >= W || !mask[si]) continue;
        const lv = ((((light[si] ?? 0) * fog) >> 8) * 4 + (BAYER[row + (sx & 3)] ?? 0)) >> 8;
        buf[sy * W + sx] = ramp + (lv > 4 ? 4 : lv);
      }
    }
  }
}

function line(buf: Uint8Array, x0: number, y0: number, x1: number, y1: number, c: number): void {
  let x = Math.round(x0),
    y = Math.round(y0);
  const xe = Math.round(x1),
    ye = Math.round(y1);
  const dx = Math.abs(xe - x),
    dy = -Math.abs(ye - y);
  const sx = x < xe ? 1 : -1,
    sy = y < ye ? 1 : -1;
  let err = dx + dy;
  for (let steps = 0; steps < 512; steps++) {
    if (x >= 0 && x < W && y >= 0 && y < H) buf[y * W + x] = c;
    if (x === xe && y === ye) return;
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
}

/** Vector style: each tube is a polyline, brighter in front; bulbs and joints are dots. */
function drawWire(buf: Uint8Array, n: number): void {
  const p = projected.data;
  for (let q = 0; q < n; q++) {
    const i = order[q] ?? 0;
    if (!((inst.glow[i] ?? 1) > 0)) continue; // a hidden rib
    const o = i * 4;
    const level = 1 + Math.round(3 * nearness(p[o + 2] ?? 3) * (inst.glow[i] ?? 1));
    const ramp = RAMP[inst.tone[i] ?? 0] ?? 2;
    if (
      i > 0 &&
      inst.chain[i] === inst.chain[i - 1] &&
      inst.tone[i] !== 2 &&
      (inst.glow[i - 1] ?? 1) > 0
    ) {
      const a = (i - 1) * 4;
      line(buf, p[a] ?? 0, p[a + 1] ?? 0, p[o] ?? 0, p[o + 1] ?? 0, ramp + level);
    }
    const x = Math.round(p[o] ?? 0),
      y = Math.round(p[o + 1] ?? 0);
    if (x >= 0 && x < W && y >= 0 && y < H) buf[y * W + x] = inst.tone[i] === 2 ? 16 : 12 + level;
  }
}

const LUTS: Uint32Array[] = [];

export interface DrawOptions {
  /** Reduced motion: no trails. */
  readonly trails?: boolean;
}

/** Draw the frame at time t into the canvas' buffer and its RGBA view. */
export function drawDemo(canvas: DemoCanvas, t: number, options: DrawOptions = {}): void {
  const { buf, genome: g } = canvas;
  const trails = options.trails !== false && g.trails > 0 && canvas.frame > 0;
  const fade = trails && canvas.frame % g.trails === 0;
  for (let y = 0; y < H; y++) {
    const bg = backdropRow(g, y, t);
    for (let x = y * W, end = x + W; x < end; x++) {
      const v = buf[x] ?? 0;
      if (!trails || v < 2 || v === 17) buf[x] = bg;
      else if (fade) buf[x] = v === 2 || v === 7 || v === 12 ? bg : v - 1;
    }
  }
  if (g.backdrop === 'stars') stars(buf, g, t);
  expand(g, t, inst);
  const n = project(inst, canvas.fr, projected).count;
  sortFarToNear(n);
  if (g.style === 'wire') drawWire(buf, n);
  else drawBobs(buf, n);
  canvas.frame++;
  const lut = (LUTS[g.palette] ??= paletteRgba(g.palette));
  for (let i = 0; i < buf.length; i++) canvas.rgba[i] = lut[buf[i] ?? 0] ?? 0;
}

export { W as DEMO_W, H as DEMO_H };
