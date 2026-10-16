/**
 * Ending pictures (128×96). One drawing function per picture with a `withCat` flag, so the
 * variant without the cat is the same scene with the cat layer left out — never a sad cat,
 * never a grave: if there is no cat, there is no cat.
 */
import { createCanvas, type PixelCanvas } from '../lib/canvas';
import { ellipse, outline, stroke } from '../lib/shapes';
import { light } from '../palette';
import { catSprites } from '../sprites/cat';
import { ILLUSTRATION, sparkle } from './common';

/** Where the sleeping cat lies on the programmer's chest (for the art tests). */
export const WEEKEND_CAT = { x: 50, y: 47 } as const;

function catFrame(tag: string): PixelCanvas {
  const frame = catSprites(light).find((s) => s.tag === tag)?.frames[0];
  if (!frame) throw new Error(`missing ${tag}`);
  return frame;
}

/** Height of the hammock's bottom edge at x (a sag between the two posts). */
const sag = (x: number) => 52 + 13 * (1 - ((x - 62) / 42) ** 2);

/** The Infinite Weekend: a beach, two palm posts, a hammock, the programmer, maybe the cat. */
export function infiniteWeekend(withCat: boolean): PixelCanvas {
  const p = light;
  const c = createCanvas(ILLUSTRATION.w, ILLUSTRATION.h);
  // Sky, sun and sea.
  c.rect(0, 0, 128, 50, p.sky);
  c.rect(0, 0, 128, 14, p.skyLight);
  c.dither(0, 14, 128, 3, p.skyLight, p.sky);
  c.disc(98, 18, 9, p.lampGlow);
  c.disc(98, 18, 7, p.gold);
  for (const [x, y] of [
    [20, 10],
    [44, 6],
  ] as const) {
    ellipse(c, x, y, 7, 2, p.star);
    ellipse(c, x + 5, y - 1, 4, 2, p.star);
  }
  c.rect(0, 46, 128, 14, p.teal);
  c.rect(0, 46, 128, 1, p.skyLight);
  for (let i = 0; i < 9; i += 1) c.rect((i * 29) % 124, 50 + (i % 3) * 3, 6, 1, p.ledBlue);
  for (let i = 0; i < 6; i += 1) c.rect(86 + i * 3, 48 + (i % 2), 2, 1, p.lampGlow);
  // Sand.
  c.rect(0, 60, 128, 36, p.paper);
  c.dither(0, 60, 128, 2, p.paperShade, p.paper);
  for (let i = 0; i < 40; i += 1) c.set((i * 37) % 128, 64 + ((i * 11) % 30), p.paperShade);
  c.rect(0, 60, 128, 1, p.paperShade);

  // Palm posts with a few fronds.
  for (const [x, lean] of [
    [16, -1],
    [108, 1],
  ] as const) {
    stroke(
      c,
      [
        [x, 86],
        [x + lean * 2, 56],
        [x + lean * 4, 30],
      ],
      2,
      p.wood,
    );
    for (let y = 34; y < 86; y += 5)
      c.rect(x - 2 + Math.round(((86 - y) / 28) * lean), y, 5, 1, p.woodDark);
    const tx = x + lean * 4;
    for (const [dx, dy] of [
      [-16, 8],
      [16, 8],
      [-12, -6],
      [12, -6],
      [0, -10],
    ] as const) {
      stroke(
        c,
        [
          [tx, 30],
          [tx + dx / 2, 30 + dy / 2 - 3],
          [tx + dx, 30 + dy],
        ],
        1,
        p.plant,
      );
    }
    c.disc(tx, 30, 2, p.plantDark);
    c.disc(tx - 2, 33, 1, p.woodDark);
    c.disc(tx + 2, 33, 1, p.woodDark);
  }

  // Ropes and the hammock.
  stroke(
    c,
    [
      [17, 44],
      [24, 52],
    ],
    0,
    p.woodDark,
  );
  stroke(
    c,
    [
      [107, 44],
      [100, 52],
    ],
    0,
    p.woodDark,
  );
  for (let x = 24; x <= 100; x += 1) {
    const y = Math.round(sag(x));
    c.rect(x, y - 4, 1, 5, (x >> 2) % 2 === 0 ? p.rug : p.rugDark);
  }

  // The programmer, lying back: head on the left, feet on the right, sunglasses on.
  const body = createCanvas(128, 96);
  const at = (x: number) => Math.round(sag(x)) - 6;
  ellipse(body, 56, at(56), 13, 4, p.hoodie);
  ellipse(body, 56, at(56) + 2, 12, 2, p.hoodieDark);
  stroke(
    body,
    [
      [68, at(68)],
      [80, at(80)],
      [90, at(90) - 3],
    ],
    2,
    p.jeans,
  );
  body.rect(90, at(90) - 7, 3, 4, p.skin);
  body.disc(38, at(38) - 2, 5, p.skin);
  ellipse(body, 35, at(38) - 6, 5, 2, p.hair);
  body.rect(31, at(38) - 5, 3, 4, p.hair);
  body.rect(37, at(38) - 3, 6, 1, p.eye);
  body.rect(38, at(38) - 2, 2, 1, p.eye);
  body.rect(41, at(38) - 2, 2, 1, p.eye);
  body.rect(40, at(38) + 1, 3, 1, p.skinShade);
  // One arm behind the head, one hanging out of the hammock.
  stroke(
    body,
    [
      [46, at(46) - 1],
      [34, at(38) - 7],
    ],
    1,
    p.hoodie,
  );
  stroke(
    body,
    [
      [60, at(60) + 2],
      [63, at(60) + 9],
    ],
    1,
    p.hoodie,
  );
  body.rect(62, at(60) + 10, 2, 2, p.skin);
  outline(body, p.outline);
  c.blit(body, 0, 0);

  // A drink with a tiny umbrella, and the laptop, closed and half buried in the sand.
  c.rect(74, 80, 5, 7, p.mug);
  c.rect(75, 81, 3, 3, p.code2);
  stroke(
    c,
    [
      [77, 80],
      [80, 74],
    ],
    0,
    p.woodDark,
  );
  ellipse(c, 80, 74, 4, 1, p.pink);
  c.rect(30, 84, 18, 3, p.metalDark);
  c.rect(30, 84, 18, 1, p.metal);
  c.rect(30, 87, 18, 2, p.paperShade);
  sparkle(c, 116, 70, p.star);

  if (withCat) {
    // The cat, asleep on the programmer's chest. Neither of them checks the metrics.
    c.blit(catFrame('cat-sleep'), WEEKEND_CAT.x, WEEKEND_CAT.y);
  }
  return c;
}
