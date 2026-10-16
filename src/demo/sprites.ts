/**
 * Pre-shaded sprites for the rasterizer ("vector bobs" of several shapes). Each pixel of a
 * shape gets a surface normal; it is lit like the balls (from the upper left, with a highlight)
 * and outlined. Shapes that are not round are rendered at 16 angles, so the rasterizer can turn
 * them along their tube (petals and scales follow the tentacles). Sprites are made on first use.
 */
export const SHAPES = ['ball', 'ring', 'gem', 'cube', 'star', 'petal', 'drop'] as const;
export type Shape = (typeof SHAPES)[number];
/** Shapes that look the same at every angle (drawn without turning). */
const ROUND: ReadonlySet<Shape> = new Set(['ball', 'ring']);
export const ANGLES = 16;

export interface Sprite {
  readonly d: number;
  readonly c: number;
  /** Lit intensity 0–255 per pixel; 0 also marks the outline. */
  readonly light: Uint8Array;
  readonly mask: Uint8Array;
}

type Normal = readonly [number, number, number] | null;
const TAU = Math.PI * 2;

const unit = (x: number, y: number, z: number): Normal => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

/** The surface normal at (x, y) in the shape's frame (radius 1, y up), or null: outside. */
function normalOf(shape: Shape, x: number, y: number): Normal {
  switch (shape) {
    case 'ball': {
      const q = x * x + y * y;
      return q > 1 ? null : [x, y, -Math.sqrt(1 - q)];
    }
    case 'ring': {
      // a torus seen from the front
      const d = Math.hypot(x, y);
      const t = (d - 0.7) / 0.3;
      if (Math.abs(t) > 1 || d === 0) return null;
      return [(t * x) / d, (t * y) / d, -Math.sqrt(1 - t * t)];
    }
    case 'gem': {
      // an octahedron: four facets and a flat top
      if (Math.abs(x) + Math.abs(y) > 1) return null;
      if (Math.abs(x) + Math.abs(y) < 0.3) return [0, 0, -1];
      return unit(Math.sign(x), Math.sign(y), -1.2);
    }
    case 'cube': {
      // three faces of a cube, seen from a corner
      if (Math.abs(x) > 0.87 || Math.abs(y) > 1 - Math.abs(x) * 0.577) return null;
      const a = Math.atan2(y, x);
      if (a > -Math.PI / 6 && a <= Math.PI / 2) return unit(0.75, 0.3, -0.6);
      if (a > Math.PI / 2 || a <= (-5 * Math.PI) / 6) return unit(-0.75, 0.3, -0.6);
      return unit(0, -0.85, -0.55);
    }
    case 'star': {
      const r = Math.hypot(x, y);
      const phase = ((((Math.atan2(y, x) / TAU) * 5) % 1) + 1) % 1;
      const reach = 0.4 + 0.6 * (1 - Math.abs(2 * phase - 1)) ** 1.6;
      if (r > reach) return null;
      // ridged like a pyramid: the slope falls away from the middle
      return unit(x * 0.9, y * 0.9, -0.7);
    }
    case 'petal': {
      // a long ellipsoid along x with a darker midrib
      const b = 0.42;
      const q = x * x + (y / b) ** 2;
      return q > 1 ? null : unit(x, (y / b) * 0.6, -Math.sqrt(1 - q) * 1.2);
    }
    case 'drop': {
      // a round head behind, a point ahead (along +x)
      const head = Math.hypot(x + 0.4, y) <= 0.6;
      const tail = x >= -0.4 && Math.abs(y) <= (0.6 * (1 - x)) / 1.4;
      if (!head && !tail) return null;
      return unit((x + 0.4) * 0.8, y * 1.5, -0.8);
    }
  }
}

const L = [-0.45, 0.65, -0.62] as const;
const LL = Math.hypot(...L);

function makeSprite(shape: Shape, radius: number, angle: number): Sprite {
  const d = Math.ceil(radius) * 2 + 1;
  const c = (d - 1) / 2;
  const mask = new Uint8Array(d * d);
  const light = new Uint8Array(d * d);
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  for (let py = 0; py < d; py++) {
    for (let px = 0; px < d; px++) {
      const sx = (px - c) / radius,
        sy = -(py - c) / radius;
      // into the shape's frame (turned by `angle`)
      const x = sx * cos + sy * sin,
        y = -sx * sin + sy * cos;
      const n = normalOf(shape, x, y);
      if (!n) continue;
      // back to the screen frame for lighting
      const nx = n[0] * cos - n[1] * sin,
        ny = n[0] * sin + n[1] * cos,
        nz = n[2];
      const lam = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / LL);
      let v = 0.14 + 0.8 * lam + 0.5 * lam ** 24;
      if (shape === 'petal' && Math.abs(y) < 0.05) v *= 0.55;
      mask[py * d + px] = 1;
      light[py * d + px] = Math.max(1, Math.min(255, Math.round(v * 255)));
    }
  }
  // a 1-pixel dark outline round anything bigger than a few pixels
  if (radius > 2) {
    const edge: number[] = [];
    for (let py = 0; py < d; py++)
      for (let px = 0; px < d; px++) {
        const i = py * d + px;
        if (!mask[i]) continue;
        if (px === 0 || py === 0 || px === d - 1 || py === d - 1) edge.push(i);
        else if (!mask[i - 1] || !mask[i + 1] || !mask[i - d] || !mask[i + d]) edge.push(i);
      }
    for (const i of edge) light[i] = 0;
  }
  return { d, c, light, mask };
}

const cache = new Map<number, Sprite>();
export const MAX_SPRITE_RADIUS = 40;

/** The sprite of a shape at a pixel radius (half-pixel steps) and an angle (radians). */
export function spriteFor(shapeIndex: number, radius: number, angle: number): Sprite {
  const shape = SHAPES[shapeIndex] ?? 'ball';
  const size = Math.max(1, Math.min(MAX_SPRITE_RADIUS * 2, Math.round(radius * 2)));
  const turn = ROUND.has(shape)
    ? 0
    : ((Math.round((angle / TAU) * ANGLES) % ANGLES) + ANGLES) % ANGLES;
  const key = (shapeIndex * 128 + size) * ANGLES + turn;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = makeSprite(shape, size / 2, (turn / ANGLES) * TAU);
    cache.set(key, sprite);
  }
  return sprite;
}

/** Whether a shape needs its tube's direction. */
export const turns = (shapeIndex: number) => !ROUND.has(SHAPES[shapeIndex] ?? 'ball');
