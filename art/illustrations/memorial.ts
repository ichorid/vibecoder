/** The two happy memorial photographs (64×48), shown slightly faded as Polaroids in Cat. */
import { createCanvas, type PixelCanvas } from '../lib/canvas';
import { ellipse, outline } from '../lib/shapes';
import { light } from '../palette';
import { catSprites } from '../sprites/cat';
import { blitScaled } from './common';

export const PHOTO = { w: 64, h: 48 } as const;

function catFrame(tag: string): PixelCanvas {
  const sprite = catSprites(light).find((s) => s.tag === tag);
  const frame = sprite?.frames[0];
  if (!frame) throw new Error(`missing ${tag}`);
  return frame;
}

/** The cat asleep on the keyboard beside the programmer's hand. */
export function keyboardPhoto(): PixelCanvas {
  const p = light;
  const c = createCanvas(PHOTO.w, PHOTO.h);
  c.rect(0, 0, 64, 48, p.wall);
  c.rect(0, 30, 64, 18, p.wood);
  c.rect(0, 30, 64, 2, p.woodLight);
  c.rect(30, 4, 30, 22, p.metalDark);
  c.rect(32, 6, 26, 18, p.screen);
  for (let i = 0; i < 4; i += 1) c.rect(35, 9 + i * 4, 10 + (i % 2) * 8, 1, p.code1);
  c.rect(4, 32, 44, 7, p.plasticDark);
  for (let x = 6; x < 46; x += 4) c.rect(x, 34, 3, 2, p.plastic);
  blitScaled(c, catFrame('cat-sleep'), 6, 14, 2);
  // Programmer's hand resting gently next to the cat.
  const hand = createCanvas(18, 10);
  ellipse(hand, 8, 6, 8, 3, p.hoodie);
  hand.rect(12, 4, 5, 4, p.skin);
  outline(hand, p.outline);
  c.blit(hand, 46, 33);
  return c;
}

/** The cat curled up happily on the programmer's lap. */
export function lapPhoto(): PixelCanvas {
  const p = light;
  const c = createCanvas(PHOTO.w, PHOTO.h);
  c.rect(0, 0, 64, 48, p.wallLight);
  c.rect(0, 38, 64, 10, p.floor);
  // Programmer seated, front view: head, hoodie, lap.
  c.disc(32, 9, 6, p.skin);
  ellipse(c, 32, 5, 7, 4, p.hair);
  c.set(30, 10, p.eye);
  c.set(34, 10, p.eye);
  c.rect(30, 13, 4, 1, p.skinShade);
  ellipse(c, 32, 28, 16, 12, p.hoodie);
  c.rect(14, 36, 36, 6, p.jeans);
  // One cat, curled up asleep on the lap.
  blitScaled(c, catFrame('cat-sleep'), 20, 20, 1);
  c.rect(10, 26, 6, 4, p.skin);
  c.rect(48, 26, 6, 4, p.skin);
  // Little heart above.
  c.rect(44, 4, 2, 2, p.pink);
  c.rect(47, 4, 2, 2, p.pink);
  c.rect(44, 6, 5, 2, p.pink);
  c.rect(45, 8, 3, 1, p.pink);
  c.set(46, 9, p.pink);
  return c;
}
