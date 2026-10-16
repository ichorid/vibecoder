/** The two happy memorial photographs (64×48), shown slightly faded as Polaroids in Cat. */
import { createCanvas, type PixelCanvas } from '../lib/canvas';
import { ellipse, outline, stroke } from '../lib/shapes';
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

/**
 * The cat curled up happily on the programmer's lap: side view in the desk chair, a hand
 * resting on the cat, the monitor waiting on the desk (chosen from five drafts).
 */
export function lapPhoto(): PixelCanvas {
  const p = light;
  const c = createCanvas(PHOTO.w, PHOTO.h);
  c.rect(0, 0, 64, 48, p.wallLight);
  c.rect(0, 40, 64, 8, p.floor);
  // Desk and monitor on the right.
  c.rect(44, 18, 20, 3, p.wood);
  c.rect(60, 21, 3, 19, p.woodDark);
  c.rect(48, 8, 14, 10, p.metalDark);
  c.rect(49, 9, 12, 8, p.screen);
  // Office chair.
  c.rect(14, 10, 5, 22, p.chair);
  c.rect(14, 30, 24, 4, p.chair);
  c.rect(25, 34, 2, 6, p.chairDark);
  c.rect(19, 40, 14, 2, p.chairDark);
  // The programmer, seated, facing the desk.
  const body = createCanvas(PHOTO.w, PHOTO.h);
  ellipse(body, 23, 22, 6, 9, p.hoodie);
  body.rect(20, 28, 18, 5, p.jeans);
  body.rect(33, 28, 5, 12, p.jeans);
  body.rect(33, 40, 7, 2, p.hoodieDark);
  body.disc(24, 9, 5, p.skin);
  ellipse(body, 22, 6, 5, 3, p.hair);
  body.set(27, 9, p.eye);
  body.rect(27, 12, 2, 1, p.skinShade);
  outline(body, p.outline);
  c.blit(body, 0, 0);
  // One cat, curled up asleep on the lap, a hand resting on it.
  c.blit(catFrame('cat-sleep'), 15, 14);
  stroke(
    c,
    [
      [25, 18],
      [31, 20],
      [34, 19],
    ],
    1,
    p.hoodie,
  );
  c.rect(33, 18, 3, 2, p.skin);
  // Little heart above.
  c.rect(36, 3, 2, 2, p.pink);
  c.rect(39, 3, 2, 2, p.pink);
  c.rect(36, 5, 5, 2, p.pink);
  c.rect(37, 7, 3, 1, p.pink);
  c.set(38, 8, p.pink);
  return c;
}
