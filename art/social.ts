/**
 * Link-preview art for chat apps and social sites: a 1200×630 Open Graph card and square icons.
 * Everything is composed from the game's own sprites (light theme) on a 3× pixel grid, so the
 * card looks like the game. The key content sits in the centre square, which WhatsApp and
 * Telegram crop to for small thumbnails.
 */
import { createCanvas, type Color, type PixelCanvas } from './lib/canvas';
import { blitScaled } from './illustrations/common';
import { light, type Palette } from './palette';
import { allSprites } from './sprites';

/** Open Graph's recommended size (1.91:1); drawn at 400×210 and scaled 3×. */
export const SOCIAL_CARD = { w: 1200, h: 630 } as const;
const SCALE = 3;
const BASE = { w: SOCIAL_CARD.w / SCALE, h: SOCIAL_CARD.h / SCALE };

export const TAGLINE = 'KEEP AUTOMATING UNTIL THE AGENTS HAVE AGENTS';

function spriteFrame(p: Palette, tag: string, frame = 0): PixelCanvas {
  const found = allSprites(p).find((s) => s.tag === tag)?.frames[frame];
  if (!found) throw new Error(`missing sprite ${tag}`);
  return found;
}

/**
 * A 5×7 face for the card's own words only: the game's 3×5 font blurs into a smudge once a chat
 * app shrinks the card to a thumbnail.
 */
const GLYPHS_5X7: Readonly<Record<string, readonly string[]>> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

const wideTextWidth = (value: string, scale: number) => (value.length * 6 - 1) * scale;

/** Card text in the 5×7 face, every pixel repeated `scale` times. */
function wideText(
  c: PixelCanvas,
  value: string,
  x: number,
  y: number,
  scale: number,
  color: Color,
): void {
  [...value].forEach((char, index) => {
    const glyph = GLYPHS_5X7[char];
    if (!glyph) throw new Error(`no 5×7 glyph for "${char}"`);
    glyph.forEach((row, gy) => {
      for (let gx = 0; gx < 5; gx += 1) {
        if (row[gx] === '1')
          c.rect(x + (index * 6 + gx) * scale, y + gy * scale, scale, scale, color);
      }
    });
  });
}

/** The starting room as the world places it (src/content/world.ts ROOM_ADDITION), 176×128. */
function room(p: Palette): PixelCanvas {
  const c = createCanvas(176, 128);
  // World → local: the room back sits at world (−88, −64).
  const at = (tag: string, x: number, y: number, frame = 0) =>
    c.blit(spriteFrame(p, tag, frame), x + 88, y + 64);
  at('room-back', -88, -64);
  at('release-frame', -84, -56);
  at('release-frame', -84, -45);
  at('room-plant-ok', 56, -22);
  at('room-desk', -38, 6);
  at('room-monitor', 2, -25);
  at('cat-bowl', 50, 46);
  // The cat sits on the desk by the keyboard (feet at world (30, 10), sprite anchored bottom-centre).
  at('cat-idle', 30 - 12, 10 - 18);
  at('programmer-typing', -36, -20);
  return c;
}

/** A thick graph link with a packet joint halfway, like the links of the expanding world. */
function link(c: PixelCanvas, p: Palette, from: [number, number], to: [number, number]): void {
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [0, 1],
  ] as const) {
    c.line(from[0] + dx, from[1] + dy, to[0] + dx, to[1] + dy, p.floorDark);
  }
  const mx = Math.round((from[0] + to[0]) / 2);
  const my = Math.round((from[1] + to[1]) / 2);
  c.rect(mx - 2, my - 2, 5, 5, p.outline);
  c.rect(mx - 1, my - 1, 3, 3, p.gold);
}

/** The 1200×630 Open Graph / Twitter card. */
export function socialCard(): PixelCanvas {
  const p = light;
  const c = createCanvas(BASE.w, BASE.h);
  c.rect(0, 0, BASE.w, BASE.h, p.wallLight);
  for (let y = 5; y < BASE.h; y += 10) {
    for (let x = 5; x < BASE.w; x += 10) c.set(x, y, p.wallShade);
  }

  // The world the room grows into: machines linked to it on both sides.
  const roomBox = { x: 112, y: 41, w: 176, h: 128 };
  const left = roomBox.x;
  const right = roomBox.x + roomBox.w - 1;
  const nodes: { tag: string; x: number; y: number; port: [number, number] }[] = [
    { tag: 'kit-terminal', x: 30, y: 30, port: [left, 70] },
    { tag: 'kit-server', x: 58, y: 96, port: [left, 110] },
    { tag: 'kit-agent', x: 22, y: 150, port: [left, 150] },
    { tag: 'kit-core', x: 340, y: 26, port: [right, 66] },
    { tag: 'kit-agent', x: 318, y: 100, port: [right, 108] },
    { tag: 'kit-executive', x: 356, y: 146, port: [right, 150] },
  ];
  for (const node of nodes) {
    const sprite = spriteFrame(p, node.tag);
    link(c, p, node.port, [node.x + (sprite.width >> 1), node.y + (sprite.height >> 1)]);
  }
  for (const node of nodes) c.blit(spriteFrame(p, node.tag), node.x, node.y);

  c.rect(roomBox.x - 2, roomBox.y - 2, roomBox.w + 4, roomBox.h + 4, p.outline);
  c.blit(room(p), roomBox.x, roomBox.y);

  // Title with a hard drop shadow, and the tagline.
  const title = 'VIBE CODER';
  const titleX = Math.round((BASE.w - wideTextWidth(title, 3)) / 2);
  wideText(c, title, titleX + 2, 10, 3, p.cat);
  wideText(c, title, titleX, 8, 3, p.outline);
  wideText(c, TAGLINE, Math.round((BASE.w - wideTextWidth(TAGLINE, 1)) / 2), 182, 1, p.outline);

  c.frame(0, 0, BASE.w, BASE.h, p.outline);
  const card = createCanvas(SOCIAL_CARD.w, SOCIAL_CARD.h);
  blitScaled(card, c, 0, 0, SCALE);
  return card;
}

/** A square icon: the sitting cat on the card's background (favicon, apple-touch-icon). */
export function socialIcon(size: number): PixelCanvas {
  const p = light;
  const cat = spriteFrame(p, 'cat-idle');
  const scale = Math.max(1, Math.floor((size * 0.8) / cat.width));
  const c = createCanvas(size, size);
  c.rect(0, 0, size, size, p.wallLight);
  blitScaled(
    c,
    cat,
    Math.round((size - cat.width * scale) / 2),
    Math.round((size - cat.height * scale) / 2),
    scale,
  );
  return c;
}
