/**
 * The orange cat, drawn procedurally from poses. One pose description per animation frame;
 * the overfed variant widens walking poses, curls lying ones into a ball and redraws sitting ones
 * (see drawRoundSitting), so every animation exists in both sizes.
 */
import { createCanvas, type Color, type PixelCanvas } from '../lib/canvas';
import { ellipse, outline, stroke, triangle } from '../lib/shapes';
import type { Palette } from '../palette';

export const CAT_FRAME = { w: 24, h: 18 } as const;

type Point = readonly [number, number];

interface Pose {
  body: { cx: number; cy: number; rx: number; ry: number };
  head: { cx: number; cy: number; r: number };
  eyes: 'open' | 'closed' | 'half' | 'wide';
  mouth?: 'open';
  tail: readonly Point[];
  legs: readonly { x: number; top: number; bottom: number }[];
  earsDown?: boolean;
  paw?: Point;
}

const GROUND = 16;
/** The sitting cat's head radius; its ears are the reference shape for every pose. */
const SITTING_HEAD_R = 3.2;

/** Two pricked-up ears on a head centred at (cx, cy) with radius r. */
function ears(c: PixelCanvas, cx: number, cy: number, r: number, fur: Color): void {
  const earTop = cy - r - 2;
  triangle(c, [cx - r, cy - r + 1], [cx - r + 2, cy - r], [cx - r + 0.5, earTop], fur);
  triangle(c, [cx + r - 2, cy - r], [cx + r, cy - r + 1], [cx + r - 0.5, earTop], fur);
}

function sitting(overrides: Partial<Pose> = {}): Pose {
  return {
    body: { cx: 10, cy: 11.5, rx: 4.5, ry: 4 },
    head: { cx: 14, cy: 6, r: SITTING_HEAD_R },
    eyes: 'open',
    tail: [
      [6, 15],
      [3, 15],
      [2, 13],
      [3, 11],
    ],
    legs: [
      { x: 12, top: 12, bottom: GROUND },
      { x: 14, top: 12, bottom: GROUND },
    ],
    ...overrides,
  };
}

function standing(step: number, overrides: Partial<Pose> = {}): Pose {
  const lift = (i: number) => ((step + i) % 2 === 0 ? 0 : 1);
  return {
    body: { cx: 10, cy: 10, rx: 6, ry: 3 },
    head: { cx: 17, cy: 6.5, r: 3.2 },
    eyes: 'open',
    tail: [
      [4, 9],
      [2, 6],
      [2, 3],
      [3 + (step % 2), 2],
    ],
    legs: [
      { x: 5, top: 11, bottom: GROUND - lift(0) },
      { x: 8, top: 11, bottom: GROUND - lift(1) },
      { x: 12, top: 11, bottom: GROUND - lift(1) },
      { x: 15, top: 11, bottom: GROUND - lift(0) },
    ],
    ...overrides,
  };
}

function lying(breath: number, overrides: Partial<Pose> = {}): Pose {
  return {
    body: { cx: 10, cy: 13.5, rx: 7, ry: 2.5 + breath * 0.5 },
    head: { cx: 17, cy: 13, r: 2.8 },
    eyes: 'closed',
    tail: [
      [3, 15],
      [5, 16],
      [9, 16],
    ],
    legs: [],
    ...overrides,
  };
}

/** Animation tags and their frames (shared by Pixi world sprites and DOM sprites). */
export const CAT_ANIMATIONS: Readonly<Record<string, { frameMs: number; poses: Pose[] }>> = {
  idle: {
    frameMs: 600,
    poses: [
      sitting(),
      sitting({
        tail: [
          [6, 15],
          [3, 15],
          [2, 13],
          [2, 10],
        ],
      }),
    ],
  },
  sleep: { frameMs: 900, poses: [lying(0), lying(1)] },
  walk: { frameMs: 140, poses: [0, 1, 2, 3].map((s) => standing(s)) },
  eat: {
    frameMs: 220,
    poses: [
      standing(0, { head: { cx: 17, cy: 10, r: 3 } }),
      standing(0, { head: { cx: 17, cy: 11, r: 3 }, eyes: 'closed' }),
    ],
  },
  play: {
    frameMs: 200,
    poses: [
      standing(0, {
        body: { cx: 9, cy: 12, rx: 6, ry: 2.5 },
        head: { cx: 16, cy: 10, r: 3 },
        eyes: 'wide',
      }),
      standing(1, {
        body: { cx: 10, cy: 8, rx: 6, ry: 3 },
        head: { cx: 17, cy: 5, r: 3.2 },
        eyes: 'wide',
        paw: [21, 6],
      }),
    ],
  },
  pet: {
    frameMs: 260,
    poses: [
      sitting({ eyes: 'closed' }),
      sitting({ eyes: 'closed', body: { cx: 9.5, cy: 11.5, rx: 4.8, ry: 4 } }),
    ],
  },
  lonely: {
    frameMs: 500,
    poses: [sitting({ head: { cx: 14, cy: 6, r: 3.2 } }), sitting({ mouth: 'open' })],
  },
  sick: {
    frameMs: 1100,
    poses: [lying(0, { eyes: 'half', earsDown: true }), lying(1, { eyes: 'half', earsDown: true })],
  },
  attention: {
    frameMs: 300,
    poses: [
      sitting({
        eyes: 'wide',
        tail: [
          [6, 14],
          [4, 11],
          [4, 7],
          [5, 4],
        ],
      }),
      sitting({
        eyes: 'wide',
        mouth: 'open',
        paw: [18, 8],
        tail: [
          [6, 14],
          [3, 11],
          [3, 7],
          [4, 4],
        ],
      }),
    ],
  },
};

function drawCat(pose: Pose, pal: Palette, round: boolean, sick: boolean): PixelCanvas {
  const c = createCanvas(CAT_FRAME.w, CAT_FRAME.h);
  const fur = sick ? pal.catSick : pal.cat;
  const lyingDown = pose.legs.length === 0;
  // Overfed and lying down: a curled-up ball — the belly widens backwards and upwards (never past
  // the ground), the head rests on its front edge, the tail wraps around the front.
  const roundLying = round && lyingDown;
  const body = roundLying
    ? { cx: pose.body.cx - 1, cy: 12.4, rx: pose.body.rx + 0.8, ry: pose.body.ry + 1 }
    : round
      ? { ...pose.body, rx: pose.body.rx + 1.8, ry: pose.body.ry + 1.2, cy: pose.body.cy - 0.4 }
      : pose.body;
  const head = roundLying
    ? { cx: pose.head.cx + 1.2, cy: pose.head.cy - 0.6, r: pose.head.r + 0.3 }
    : pose.head;
  // Sitting poses (two front legs) get their own overfed drawing; walking/lying ones widen.
  if (round && pose.legs.length === 2) return drawRoundSitting(pose, pal, sick);
  const tail: readonly Point[] = roundLying
    ? [
        [3, 16.6],
        [9, 17.2],
        [14, 17],
        [16.5, 15.6],
      ]
    : pose.tail;
  stroke(c, tail, 0.8, fur);
  for (const leg of pose.legs) c.rect(leg.x, leg.top, 2, leg.bottom - leg.top, fur);
  ellipse(c, body.cx, body.cy, body.rx, body.ry, fur);
  // Stripes along the back.
  for (let i = -1; i <= 1; i += 1) {
    const x = Math.round(body.cx + i * 2.5);
    c.rect(x, Math.round(body.cy - body.ry), 1, 2, pal.catDark);
  }
  // Pale chest/belly (a low, small patch on the curled-up ball).
  if (roundLying) {
    ellipse(
      c,
      body.cx + body.rx * 0.35,
      body.cy + body.ry * 0.6,
      body.rx * 0.28,
      0.9,
      pal.catWhite,
    );
  } else {
    ellipse(
      c,
      body.cx + body.rx * 0.45,
      body.cy + body.ry * 0.35,
      Math.max(1, body.rx * 0.35),
      1.2,
      pal.catWhite,
    );
  }
  for (const leg of pose.legs) c.rect(leg.x, leg.bottom - 1, 2, 1, pal.catWhite);
  if (pose.paw) c.rect(pose.paw[0] - 1, pose.paw[1], 2, 2, pal.catWhite);
  const { cx, cy, r } = head;
  c.disc(Math.round(cx), Math.round(cy), Math.round(r), fur);
  // Where the resting head meets the big belly, a fur seam keeps the face readable.
  if (roundLying) c.rect(Math.round(cx - r), Math.round(cy - 1), 1, 3, pal.catDark);
  if (pose.earsDown) {
    triangle(c, [cx - r, cy - r + 1], [cx - r + 2, cy - r], [cx - r + 0.5, cy - r + 1], fur);
    triangle(c, [cx + r - 2, cy - r], [cx + r, cy - r + 1], [cx + r - 0.5, cy - r + 1], fur);
  } else {
    // Every pricked-up ear is the sitting cat's, on the drawn (rounded) head: fractional head
    // positions and radii would otherwise rasterise into spikes or upright stubs.
    ears(c, Math.round(cx), Math.round(cy), SITTING_HEAD_R, fur);
  }
  c.rect(Math.round(cx), Math.round(cy + 1), 2, 1, pal.catWhite);
  const ex = Math.round(cx - 1);
  const ey = Math.round(cy - 0.5);
  switch (pose.eyes) {
    case 'open':
      c.set(ex, ey, pal.eye);
      c.set(ex + 3, ey, pal.eye);
      break;
    case 'wide':
      c.rect(ex, ey - 1, 1, 2, pal.eye);
      c.rect(ex + 3, ey - 1, 1, 2, pal.eye);
      break;
    case 'half':
      c.set(ex, ey + 1, pal.eye);
      c.set(ex + 3, ey + 1, pal.eye);
      break;
    case 'closed':
      c.rect(ex - 1, ey, 2, 1, pal.catDark);
      c.rect(ex + 2, ey, 2, 1, pal.catDark);
      break;
  }
  c.set(Math.round(cx + 1), Math.round(cy + 1), pal.catNose);
  if (pose.mouth === 'open') c.rect(Math.round(cx), Math.round(cy + 2), 2, 1, pal.eye);
  outline(c, pal.outline);
  return c;
}

export interface SpriteFrames {
  readonly tag: string;
  readonly frameMs: number;
  readonly frames: readonly PixelCanvas[];
}

/** All cat animations: `cat-<tag>` and the overfed `cat-round-<tag>`. */
export function catSprites(pal: Palette): SpriteFrames[] {
  const sprites: SpriteFrames[] = [];
  for (const [tag, animation] of Object.entries(CAT_ANIMATIONS)) {
    const sick = tag === 'sick';
    sprites.push({
      tag: `cat-${tag}`,
      frameMs: animation.frameMs,
      frames: animation.poses.map((p) => drawCat(p, pal, false, sick)),
    });
    sprites.push({
      tag: `cat-round-${tag}`,
      frameMs: animation.frameMs,
      frames: animation.poses.map((p) => drawCat(p, pal, true, sick)),
    });
  }
  return sprites;
}

/**
 * The overfed cat sitting, standing or asking (chosen from five drawn variants): a pear-shaped
 * belly that stays on the ground, front paws drawn over it so they remain visible, the head on
 * top with a neck seam, and the tail wrapped around the base — upright and thin only when the
 * pose asks for attention (a cat's excited tail, not a squirrel's bushy one).
 */
function drawRoundSitting(pose: Pose, pal: Palette, sick: boolean): PixelCanvas {
  const c = createCanvas(CAT_FRAME.w, CAT_FRAME.h);
  const fur = sick ? pal.catSick : pal.cat;
  const upright = (pose.tail.at(-1)?.[1] ?? 10) < 6;
  const head = { ...pose.head, r: pose.head.r + 0.3, cx: pose.head.cx + 0.6 };
  const body = { cx: 10, cy: 12.8, rx: 6.4, ry: 3.8 };
  const tail: Point[] = upright
    ? [
        [4.5, 14],
        [2.5, 11],
        [2.5, 8],
        [4, 6],
      ]
    : [
        [4, 16],
        [8, 16.8],
        [12, 16.8],
      ];
  const paws = [
    { x: 12, top: 13 },
    { x: 15, top: 13 },
  ];
  stroke(c, tail, 0.8, fur);
  ellipse(c, body.cx, body.cy, body.rx, body.ry, fur);
  for (let i = -1; i <= 1; i += 1) {
    c.rect(Math.round(body.cx - 1 + i * 2.5), Math.round(body.cy - body.ry), 1, 2, pal.catDark);
  }
  ellipse(c, body.cx + body.rx * 0.35, body.cy + body.ry * 0.3, body.rx * 0.32, 1.5, pal.catWhite);
  // Front paws drawn over the belly so they stay visible.
  for (const paw of paws) {
    c.rect(paw.x, paw.top, 2, GROUND - paw.top, fur);
    c.rect(paw.x, GROUND - 1, 2, 1, pal.catWhite);
    c.set(paw.x - 1, paw.top, pal.catDark);
  }
  if (pose.paw) c.rect(pose.paw[0] - 1, pose.paw[1], 2, 2, pal.catWhite);
  const { cx, cy, r } = head;
  c.disc(Math.round(cx), Math.round(cy), Math.round(r), fur);
  // Neck seam: the head sits on the body instead of melting into it.
  c.rect(Math.round(cx - r), Math.round(cy + r - 1), Math.round(r), 1, pal.catDark);
  ears(c, cx, cy, r, fur);
  c.rect(Math.round(cx), Math.round(cy + 1), 2, 1, pal.catWhite);
  const ex = Math.round(cx - 1);
  const ey = Math.round(cy - 0.5);
  if (pose.eyes === 'wide') {
    c.rect(ex, ey - 1, 1, 2, pal.eye);
    c.rect(ex + 3, ey - 1, 1, 2, pal.eye);
  } else if (pose.eyes === 'closed') {
    c.rect(ex - 1, ey, 2, 1, pal.catDark);
    c.rect(ex + 2, ey, 2, 1, pal.catDark);
  } else {
    c.set(ex, ey, pal.eye);
    c.set(ex + 3, ey, pal.eye);
  }
  c.set(Math.round(cx + 1), Math.round(cy + 1), pal.catNose);
  if (pose.mouth === 'open') c.rect(Math.round(cx), Math.round(cy + 2), 2, 1, pal.eye);
  outline(c, pal.outline);
  return c;
}
