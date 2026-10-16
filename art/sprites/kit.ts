/**
 * Reusable world kit: machines the expanding system is built from. Each motif has a detailed
 * sprite (animated where it blinks) and an 8×8 compact LOD icon of the same silhouette/color.
 */
import { createCanvas, type PixelCanvas } from '../lib/canvas';
import { text } from '../lib/font';
import { ellipse, outline, stroke, triangle } from '../lib/shapes';
import type { Palette } from '../palette';
import type { SpriteFrames } from './cat';

type Draw = (c: PixelCanvas, p: Palette, frame: number) => void;

interface Motif {
  readonly id: string;
  readonly w: number;
  readonly h: number;
  readonly frames: number;
  readonly frameMs: number;
  readonly draw: Draw;
  /** Dominant color key for its compact icon and dots. */
  readonly accent: (p: Palette) => string;
}

const blink = (frame: number, on: string, off: string) => (frame % 2 === 0 ? on : off);

export const MOTIFS: readonly Motif[] = [
  {
    id: 'terminal',
    w: 26,
    h: 20,
    frames: 2,
    frameMs: 450,
    accent: (p) => p.glow,
    draw(c, p, f) {
      c.rect(1, 1, 24, 16, p.metalDark);
      c.rect(3, 3, 20, 12, p.screenDark);
      c.rect(5, 5, 2, 1, p.glow);
      c.rect(8, 5, 8, 1, p.glowDim);
      c.rect(5, 8, 12, 1, p.glowDim);
      c.rect(5, 11, 2, 1, p.glow);
      c.rect(8, 11, 2, 1, blink(f, p.glow, p.screenDark));
      c.rect(9, 17, 8, 2, p.metal);
    },
  },
  {
    id: 'server',
    w: 18,
    h: 30,
    frames: 2,
    frameMs: 380,
    accent: (p) => p.ledGreen,
    draw(c, p, f) {
      c.rect(1, 1, 16, 28, p.metalDark);
      for (let i = 0; i < 5; i += 1) {
        c.rect(3, 3 + i * 5, 12, 4, p.metal);
        c.set(4, 4 + i * 5, (i + f) % 3 === 0 ? p.ledAmber : p.ledGreen);
        c.set(6, 4 + i * 5, blink(f + i, p.ledGreen, p.metalDark));
        c.rect(9, 5 + i * 5, 5, 1, p.metalLight);
      }
    },
  },
  {
    id: 'agent',
    w: 18,
    h: 18,
    frames: 2,
    frameMs: 320,
    accent: (p) => p.teal,
    draw(c, p, f) {
      c.rect(8, 0, 2, 3, p.metalDark);
      c.set(8, 0, blink(f, p.ledRed, p.metalDark));
      c.rect(3, 3, 12, 9, p.teal);
      c.rect(5, 6, 2, 2 - (f % 2), p.screenDark);
      c.rect(11, 6, 2, 2 - (f % 2), p.screenDark);
      c.rect(7, 9, 4, 1, p.screenDark);
      c.rect(5, 12, 8, 5, p.metal);
      c.rect(2, 13, 2, 3, p.metal);
      c.rect(14, 13, 2, 3, p.metal);
    },
  },
  {
    id: 'reviewer',
    w: 20,
    h: 16,
    frames: 2,
    frameMs: 700,
    accent: (p) => p.violet,
    draw(c, p, f) {
      ellipse(c, 10, 8, 8, 5, p.paper);
      c.disc(10, 8, 3, p.violet);
      c.disc(10, 8, 1, p.screenDark);
      if (f === 1) c.rect(2, 7, 16, 2, p.paperShade);
      c.rect(14, 12, 5, 3, p.ledGreen);
      c.set(15, 13, p.screenDark);
      c.set(16, 14, p.screenDark);
      c.set(17, 13, p.screenDark);
    },
  },
  {
    id: 'test',
    w: 16,
    h: 16,
    frames: 2,
    frameMs: 500,
    accent: (p) => p.ledGreen,
    draw(c, p, f) {
      c.rect(1, 1, 14, 14, p.paper);
      c.rect(1, 1, 14, 3, p.paperShade);
      const mark = f === 0 ? p.ledGreen : p.ledAmber;
      stroke(
        c,
        [
          [4, 9],
          [7, 12],
          [12, 6],
        ],
        0.6,
        mark,
      );
    },
  },
  {
    id: 'node',
    w: 10,
    h: 10,
    frames: 2,
    frameMs: 600,
    accent: (p) => p.ledBlue,
    draw(c, p, f) {
      c.disc(5, 5, 4, p.ledBlue);
      c.disc(5, 5, 2, blink(f, p.skyLight, p.ledBlue));
    },
  },
  {
    id: 'manager',
    w: 20,
    h: 20,
    frames: 2,
    frameMs: 400,
    accent: (p) => p.gold,
    draw(c, p, f) {
      triangle(c, [5, 4], [15, 4], [10, 0], p.gold);
      c.set(7, 2, p.gold);
      c.set(13, 2, p.gold);
      c.rect(4, 5, 12, 9, p.violet);
      c.rect(6, 8, 2, 2, p.screenDark);
      c.rect(12, 8, 2, 2, p.screenDark);
      c.rect(8, 12, 4, 1, f === 0 ? p.screenDark : p.violet);
      c.rect(6, 14, 8, 5, p.metal);
      c.rect(9, 14, 2, 4, p.ledRed);
    },
  },
  {
    id: 'scroll',
    w: 14,
    h: 18,
    frames: 1,
    frameMs: 1000,
    accent: (p) => p.paper,
    draw(c, p) {
      c.rect(2, 2, 10, 14, p.paper);
      c.rect(1, 1, 12, 2, p.paperShade);
      c.rect(1, 15, 12, 2, p.paperShade);
      for (let i = 0; i < 4; i += 1) c.rect(4, 5 + i * 3, 6 - (i % 2) * 2, 1, p.metalDark);
    },
  },
  {
    id: 'loop',
    w: 20,
    h: 20,
    frames: 2,
    frameMs: 250,
    accent: (p) => p.ledAmber,
    draw(c, p, f) {
      for (let a = 0; a < 28; a += 1) {
        const angle = (a / 28) * Math.PI * 2;
        if (a < 24)
          c.set(
            10 + Math.round(Math.cos(angle) * 7),
            10 + Math.round(Math.sin(angle) * 7),
            p.ledAmber,
          );
        if (a < 24)
          c.set(
            10 + Math.round(Math.cos(angle) * 6),
            10 + Math.round(Math.sin(angle) * 6),
            p.ledAmber,
          );
      }
      const head = f === 0 ? ([17, 7] as const) : ([3, 13] as const);
      c.disc(head[0], head[1], 2, p.ledRed);
    },
  },
  {
    id: 'gear',
    w: 16,
    h: 16,
    frames: 2,
    frameMs: 200,
    accent: (p) => p.metalLight,
    draw(c, p, f) {
      for (let t = 0; t < 8; t += 1) {
        const angle = (t / 8) * Math.PI * 2 + (f * Math.PI) / 8;
        c.disc(
          8 + Math.round(Math.cos(angle) * 6),
          8 + Math.round(Math.sin(angle) * 6),
          1,
          p.metal,
        );
      }
      c.disc(8, 8, 5, p.metal);
      c.disc(8, 8, 2, p.metalDark);
    },
  },
  {
    id: 'router',
    w: 22,
    h: 16,
    frames: 2,
    frameMs: 300,
    accent: (p) => p.pink,
    draw(c, p, f) {
      c.rect(1, 6, 20, 9, p.plasticDark);
      c.rect(2, 7, 18, 3, p.pink);
      for (let i = 0; i < 4; i += 1)
        c.set(4 + i * 4, 12, (i + f) % 2 === 0 ? p.ledGreen : p.ledAmber);
      c.rect(4, 1, 1, 5, p.metalDark);
      c.rect(17, 1, 1, 5, p.metalDark);
    },
  },
  {
    id: 'memory',
    w: 24,
    h: 14,
    frames: 2,
    frameMs: 500,
    accent: (p) => p.code2,
    draw(c, p, f) {
      c.rect(1, 2, 22, 10, p.plant);
      for (let i = 0; i < 5; i += 1) c.rect(3 + i * 4, 4, 3, 5, p.screenDark);
      c.set(3 + ((f * 2) % 5) * 4 + 1, 6, p.code2);
      for (let i = 0; i < 10; i += 1) c.rect(2 + i * 2, 12, 1, 2, p.gold);
    },
  },
  {
    id: 'gauge',
    w: 20,
    h: 14,
    frames: 2,
    frameMs: 600,
    accent: (p) => p.ledAmber,
    draw(c, p, f) {
      ellipse(c, 10, 11, 9, 9, p.panel);
      c.rect(0, 12, 20, 2, p.panelDark);
      c.set(3, 9, p.ledRed);
      c.set(10, 3, p.ledAmber);
      c.set(17, 9, p.ledGreen);
      stroke(c, [[10, 11], f === 0 ? [15, 6] : [16, 8]], 0, p.screenDark);
    },
  },
  {
    id: 'pipeline',
    w: 34,
    h: 14,
    frames: 2,
    frameMs: 220,
    accent: (p) => p.metalLight,
    draw(c, p, f) {
      c.rect(0, 4, 34, 6, p.metal);
      c.rect(0, 4, 34, 1, p.metalLight);
      for (let i = 0; i < 4; i += 1) c.rect((i * 9 + f * 4) % 34, 6, 3, 2, p.code4);
      c.rect(2, 1, 4, 12, p.metalDark);
      c.rect(28, 1, 4, 12, p.metalDark);
    },
  },
  {
    id: 'office',
    w: 22,
    h: 26,
    frames: 2,
    frameMs: 900,
    accent: (p) => p.wallLight,
    draw(c, p, f) {
      c.rect(2, 2, 18, 23, p.panel);
      c.rect(2, 2, 18, 2, p.panelDark);
      for (let y = 0; y < 5; y += 1) {
        for (let x = 0; x < 4; x += 1) {
          c.rect(4 + x * 4, 6 + y * 4, 2, 2, (x + y + f) % 3 === 0 ? p.lampGlow : p.screenDark);
        }
      }
    },
  },
  {
    id: 'chart',
    w: 20,
    h: 16,
    frames: 2,
    frameMs: 600,
    accent: (p) => p.ledGreen,
    draw(c, p, f) {
      c.rect(1, 1, 18, 14, p.paper);
      const ys = f === 0 ? [11, 9, 10, 6, 4] : [11, 10, 8, 7, 3];
      stroke(
        c,
        ys.map((y, i) => [3 + i * 3.5, y] as const),
        0,
        p.ledGreen,
      );
      c.rect(2, 13, 16, 1, p.metalDark);
    },
  },
  {
    id: 'megaphone',
    w: 18,
    h: 14,
    frames: 2,
    frameMs: 350,
    accent: (p) => p.ledRed,
    draw(c, p, f) {
      triangle(c, [2, 5], [2, 9], [13, 0], p.ledRed);
      triangle(c, [2, 9], [13, 14], [13, 0], p.ledRed);
      c.rect(0, 5, 3, 5, p.metalDark);
      if (f === 1) {
        c.set(16, 4, p.gold);
        c.set(16, 10, p.gold);
        c.set(17, 7, p.gold);
      }
    },
  },
  {
    id: 'executive',
    w: 18,
    h: 20,
    frames: 2,
    frameMs: 700,
    accent: (p) => p.screenDark,
    draw(c, p, f) {
      c.rect(3, 1, 12, 9, p.metalDark);
      c.rect(5, 4, 3, 2, f === 0 ? p.ledRed : p.ledAmber);
      c.rect(10, 4, 3, 2, f === 0 ? p.ledRed : p.ledAmber);
      c.rect(2, 10, 14, 9, p.screenDark);
      triangle(c, [8, 10], [10, 10], [9, 17], p.ledRed);
    },
  },
  {
    id: 'core',
    w: 26,
    h: 26,
    frames: 2,
    frameMs: 400,
    accent: (p) => p.violet,
    draw(c, p, f) {
      c.disc(13, 13, 11, p.violet);
      c.disc(13, 13, 8, p.screenDark);
      c.disc(13, 13, 4 + f, p.pink);
      text(c, f === 0 ? '0' : '1', 12, 11, p.paper);
    },
  },
  {
    id: 'packet',
    w: 5,
    h: 5,
    frames: 1,
    frameMs: 1000,
    accent: (p) => p.code2,
    draw(c, p) {
      c.rect(1, 1, 3, 3, p.code2);
    },
  },
];

/** 8×8 compact icon: the motif's accent silhouette for the middle LOD band. */
function compactIcon(p: Palette, motif: Motif): PixelCanvas {
  const c = createCanvas(8, 8);
  c.rect(1, 1, 6, 6, motif.accent(p));
  c.rect(2, 2, 2, 2, p.screenDark);
  outline(c, p.outline);
  return c;
}

export function kitSprites(p: Palette): SpriteFrames[] {
  const sprites: SpriteFrames[] = [];
  for (const motif of MOTIFS) {
    const frames: PixelCanvas[] = [];
    for (let f = 0; f < motif.frames; f += 1) {
      const c = createCanvas(motif.w, motif.h);
      motif.draw(c, p, f);
      // Motifs draw inside a 1-px margin; the outline pass completes the silhouette.
      outline(c, p.outline);
      frames.push(c);
    }
    sprites.push({ tag: `kit-${motif.id}`, frameMs: motif.frameMs, frames });
    sprites.push({ tag: `lod-${motif.id}`, frameMs: 1000, frames: [compactIcon(p, motif)] });
  }
  return sprites;
}
