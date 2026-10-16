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
  // A coffee mug, still steaming, beside the sleeping cat.
  const mug = createCanvas(64, 48);
  mug.rect(52, 30, 8, 9, p.mug);
  mug.rect(60, 32, 2, 4, p.mug);
  mug.rect(53, 31, 6, 2, p.food);
  outline(mug, p.outline);
  c.blit(mug, 0, 0);
  for (const [x, y] of [
    [55, 27],
    [56, 26],
    [55, 25],
    [57, 28],
  ] as const)
    c.set(x, y, p.paper);
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
  c.rect(45, 21, 3, 19, p.woodDark);
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
  // Short hair: a cap over the top and the back of the head, a sideburn, an ear.
  body.disc(24, 9, 5, p.skin);
  body.rect(20, 4, 9, 2, p.hair);
  body.rect(19, 6, 9, 1, p.hair);
  body.rect(19, 7, 4, 4, p.hair);
  body.rect(19, 11, 3, 1, p.hair);
  body.set(23, 9, p.skinShade);
  body.set(23, 10, p.skinShade);
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
