/** The original room at world (0, 0): back wall/floor, desk, monitor, programmer, cat bowl. */
import { createCanvas, type PixelCanvas } from '../lib/canvas';
import { text } from '../lib/font';
import { ellipse, outline } from '../lib/shapes';
import type { Palette } from '../palette';
import type { SpriteFrames } from './cat';

export const ROOM_SIZE = { w: 176, h: 128 } as const;

function roomBack(p: Palette): PixelCanvas {
  const c = createCanvas(ROOM_SIZE.w, ROOM_SIZE.h);
  const { w, h } = ROOM_SIZE;
  const floorY = 84;
  c.rect(0, 0, w, h, p.outline);
  c.rect(2, 2, w - 4, floorY - 2, p.wall);
  c.dither(2, floorY - 6, w - 4, 4, p.wall, p.wallShade);
  c.rect(2, floorY - 2, w - 4, 2, p.wallShade);
  c.rect(2, 2, w - 4, 3, p.wallLight);
  // Floor planks.
  c.rect(2, floorY, w - 4, h - floorY - 2, p.floor);
  for (let y = floorY + 6; y < h - 2; y += 8) c.rect(2, y, w - 4, 1, p.floorDark);
  for (let i = 0; i < 12; i += 1) {
    const y = floorY + 1 + Math.floor(i / 4) * 8 + 8 * (i % 2);
    c.rect(10 + ((i * 37) % (w - 30)), Math.min(y, h - 4), 1, 6, p.floorDark);
  }
  c.rect(2, floorY, w - 4, 1, p.floorLight);
  // Rug.
  ellipse(c, 64, 112, 34, 7, p.rugDark);
  ellipse(c, 64, 111, 32, 6, p.rug);
  // Window with night/day sky (abstract sky only, no city).
  c.rect(122, 12, 40, 34, p.outline);
  c.rect(124, 14, 36, 30, p.sky);
  c.rect(124, 14, 36, 10, p.skyLight);
  c.rect(141, 14, 2, 30, p.outline);
  c.rect(124, 28, 36, 2, p.outline);
  for (const [x, y] of [
    [128, 18],
    [152, 33],
    [134, 38],
    [156, 20],
  ] as const)
    c.set(x, y, p.star);
  c.rect(120, 46, 44, 3, p.woodLight);
  // Poster.
  c.rect(14, 12, 30, 38, p.outline);
  c.rect(16, 14, 26, 34, p.poster);
  text(c, 'JUST', 21, 18, p.posterInk);
  text(c, 'ONE', 23, 25, p.posterInk);
  text(c, 'MORE', 21, 32, p.posterInk);
  c.rect(19, 40, 20, 4, p.posterInk);
  // Shelf with books and a tiny robot toy.
  c.rect(58, 26, 40, 3, p.woodDark);
  const books = [p.book1, p.book2, p.book3, p.book1, p.book2];
  books.forEach((color, i) => c.rect(60 + i * 5, 15 + (i % 2) * 2, 4, 11 - (i % 2) * 2, color));
  c.rect(86, 19, 7, 7, p.metal);
  c.set(88, 21, p.ledBlue);
  c.set(91, 21, p.ledBlue);
  // Plant in the corner.
  c.rect(150, 64, 14, 18, p.pot);
  c.rect(149, 64, 16, 3, p.rugDark);
  for (const [x, y, r] of [
    [152, 56, 5],
    [160, 52, 5],
    [156, 46, 4],
    [163, 60, 4],
    [148, 60, 4],
  ] as const) {
    c.disc(x, y, r, p.plant);
  }
  c.disc(156, 50, 2, p.plantDark);
  c.disc(150, 58, 2, p.plantDark);
  // Floor lamp.
  c.rect(108, 40, 2, 44, p.metalDark);
  c.rect(102, 34, 14, 7, p.lamp);
  c.dither(100, 41, 18, 3, p.lampGlow, p.wall);
  c.rect(104, 82, 10, 2, p.metalDark);
  return c;
}

function desk(p: Palette): PixelCanvas {
  const c = createCanvas(104, 44);
  c.rect(0, 4, 104, 6, p.wood);
  c.rect(0, 4, 104, 1, p.woodLight);
  c.rect(0, 9, 104, 1, p.woodDark);
  c.rect(4, 10, 6, 34, p.woodDark);
  c.rect(94, 10, 6, 34, p.woodDark);
  c.rect(70, 10, 24, 14, p.wood);
  c.rect(80, 15, 4, 2, p.woodLight);
  // Keyboard, mouse, mug.
  c.rect(34, 1, 30, 3, p.plasticDark);
  for (let x = 35; x < 63; x += 3) c.rect(x, 1, 2, 1, p.plastic);
  c.rect(68, 2, 4, 2, p.plastic);
  c.rect(84, -2 + 2, 7, 4, p.mug);
  c.rect(91, 1, 2, 2, p.mug);
  outline(c, p.outline);
  return c;
}

function monitor(p: Palette, frame: number): PixelCanvas {
  const c = createCanvas(48, 36);
  c.rect(2, 2, 44, 28, p.metalDark);
  c.rect(4, 4, 40, 24, p.screen);
  const colors = [p.code1, p.code2, p.code4, p.code3, p.code1, p.code2];
  for (let line = 0; line < 6; line += 1) {
    const indent = ((line + frame) % 3) * 3;
    const length = 6 + ((line * 7 + frame * 5) % 5) * 5;
    c.rect(
      6 + indent,
      6 + line * 3 + 1,
      Math.min(length, 34 - indent),
      1,
      colors[(line + frame) % 6] ?? p.code1,
    );
  }
  if (frame % 2 === 0) c.rect(6, 25, 3, 1, p.glow);
  c.rect(20, 30, 8, 3, p.metalDark);
  c.rect(14, 33, 20, 2, p.metal);
  outline(c, p.outline);
  return c;
}

/**
 * The programmer at desk scale (desk 40 px ≈ 72 cm, so ≈ 0.56 px/cm): an office chair standing on
 * the floor with the seat at ≈ 45 cm, shoulders ≈ 55 cm above it, eyes near the monitor top, legs
 * under the desk, hands on the keyboard. Placed at world (−36, −20) so the wheels meet the floor
 * line of the desk legs (world y 50); local = world + (36, 20).
 */
function programmer(p: Palette, frame: number): PixelCanvas {
  const c = createCanvas(36, 70);
  // Chair: back behind the torso, seat, gas lift, five-star base on wheels.
  c.rect(5, 14, 9, 32, p.chair);
  c.rect(5, 14, 9, 2, p.chairDark);
  c.rect(6, 43, 24, 4, p.chair);
  c.rect(6, 46, 24, 1, p.chairDark);
  c.rect(16, 47, 4, 17, p.chairDark);
  c.rect(8, 64, 20, 2, p.chairDark);
  for (const x of [8, 17, 26]) c.rect(x, 66, 2, 2, p.chairDark);
  // Legs: thighs forward on the seat, shins down under the desk, shoes on the floor.
  c.rect(17, 39, 14, 5, p.jeans);
  c.rect(27, 43, 5, 21, p.jeans);
  c.rect(26, 64, 9, 3, p.chairDark);
  // Torso in a hoodie, seen from behind at three-quarters.
  ellipse(c, 18, 29, 9, 13, p.hoodie);
  c.rect(10, 32, 16, 9, p.hoodieDark);
  // Arms reaching to the keyboard; hands alternate while typing.
  c.rect(22, 18, 6, 9, p.hoodie);
  c.rect(24, 24, 10, 4, p.hoodie);
  c.rect(33, 24 + (frame % 2), 3, 2, p.skin);
  c.rect(22, 28, 11, 3, p.hoodieDark);
  c.rect(32, 28 + ((frame + 1) % 2), 3, 2, p.skinShade);
  // Neck, head and hair (face turned to the monitor on the right).
  c.rect(16, 13, 5, 4, p.skinShade);
  c.disc(19, 8, 7, p.skin);
  ellipse(c, 17, 5, 8, 5, p.hair);
  c.rect(11, 4, 5, 9, p.hair);
  c.rect(20, 1, 5, 2, p.hair);
  c.set(25, 9, p.skinShade);
  c.set(24, 12, p.skinShade);
  outline(c, p.outline);
  return c;
}

function bowl(p: Palette): PixelCanvas {
  const c = createCanvas(14, 8);
  ellipse(c, 7, 3, 5, 2, p.food);
  c.rect(1, 3, 12, 3, p.bowl);
  c.rect(3, 6, 8, 1, p.bowl);
  outline(c, p.outline);
  return c;
}

export function roomSprites(p: Palette): SpriteFrames[] {
  return [
    { tag: 'room-back', frameMs: 1000, frames: [roomBack(p)] },
    { tag: 'room-desk', frameMs: 1000, frames: [desk(p)] },
    { tag: 'room-monitor', frameMs: 260, frames: [0, 1, 2].map((f) => monitor(p, f)) },
    { tag: 'programmer-typing', frameMs: 180, frames: [0, 1].map((f) => programmer(p, f)) },
    { tag: 'cat-bowl', frameMs: 1000, frames: [bowl(p)] },
  ];
}
