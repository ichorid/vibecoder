/**
 * Ending pictures (128×96). One drawing function per picture with a `withCat` flag, so the
 * variant without the cat is the same scene with the cat layer left out — never a sad cat,
 * never a grave: if there is no cat, there is no cat.
 */
import { createCanvas, type PixelCanvas } from '../lib/canvas';
import { text } from '../lib/font';
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

/** Where the cat's cardboard box stands at the programmer's feet (for the art tests). */
export const STREET_BOX = { x: 74, y: 70, w: 26, h: 18 } as const;

/**
 * AI Got My Job: a brick wall, a pavement, the programmer sitting on a folded blanket with a
 * beard and a cardboard sign. With the cat, a box at their feet with the cat asleep inside;
 * without it, nothing there at all.
 */
export function aiGotMyJob(withCat: boolean): PixelCanvas {
  const p = light;
  const c = createCanvas(ILLUSTRATION.w, ILLUSTRATION.h);
  // Brick wall.
  c.rect(0, 0, 128, 62, p.wallShade);
  for (let row = 0; row < 12; row += 1) {
    const y = row * 5;
    c.rect(0, y, 128, 1, p.wall);
    for (let x = (row % 2) * 6; x < 128; x += 12) c.rect(x, y, 1, 5, p.wall);
  }
  c.dither(0, 52, 128, 10, p.wallShade, p.metalDark);
  // A shop window, dark, with a "WE ARE HIRING (AGENTS)" sticker.
  c.rect(84, 6, 40, 34, p.screenDark);
  c.rect(84, 6, 40, 2, p.metalDark);
  c.rect(86, 30, 36, 8, p.paper);
  text(c, 'HIRING', 92, 31, p.ledRed);
  // Pavement.
  c.rect(0, 62, 128, 34, p.metal);
  c.rect(0, 62, 128, 1, p.metalDark);
  for (let x = 0; x < 128; x += 16) c.rect(x, 62, 1, 34, p.metalDark);
  c.rect(0, 80, 128, 1, p.metalDark);
  // A paper cup with a coin.
  c.rect(60, 82, 6, 7, p.paper);
  c.rect(60, 82, 6, 1, p.paperShade);
  c.rect(62, 83, 2, 1, p.gold);

  // The programmer: sitting against the wall on a blanket, beard, hoodie, knees up.
  const body = createCanvas(128, 96);
  body.rect(14, 76, 40, 6, p.rugDark);
  body.rect(14, 76, 40, 1, p.rug);
  ellipse(body, 30, 66, 9, 10, p.hoodie);
  ellipse(body, 30, 70, 8, 6, p.hoodieDark);
  stroke(
    body,
    [
      [24, 76],
      [38, 70],
      [46, 77],
    ],
    2,
    p.jeans,
  );
  body.rect(45, 76, 4, 2, p.chairDark);
  body.disc(30, 50, 6, p.skin);
  ellipse(body, 30, 45, 6, 3, p.hair);
  // The beard: a lot of it.
  ellipse(body, 30, 55, 6, 4, p.hair);
  body.rect(26, 52, 9, 2, p.hair);
  body.rect(28, 49, 1, 1, p.eye);
  body.rect(32, 49, 1, 1, p.eye);
  outline(body, p.outline);
  c.blit(body, 0, 0);

  // The cardboard sign, held up in both hands.
  c.rect(4, 56, 62, 16, p.food);
  c.rect(4, 56, 62, 1, p.woodLight);
  c.rect(4, 71, 62, 1, p.woodDark);
  c.rect(4, 56, 1, 16, p.woodDark);
  c.rect(65, 56, 1, 16, p.woodDark);
  text(c, 'AI GOT MY JOB', 10, 58, p.outline);
  text(c, 'PLZ HLP', 22, 65, p.outline);
  // Hands on the sign's edges, clear of the words.
  c.rect(2, 61, 3, 3, p.skin);
  c.rect(65, 61, 3, 3, p.skin);

  if (withCat) {
    // A cardboard box at their feet; the cat asleep inside. Nobody asked it to leave.
    const b = STREET_BOX;
    c.rect(b.x, b.y + 6, b.w, b.h - 6, p.food);
    c.rect(b.x, b.y + 6, b.w, 1, p.woodDark);
    c.rect(b.x - 2, b.y + 4, 6, 3, p.woodLight);
    c.rect(b.x + b.w - 4, b.y + 4, 6, 3, p.woodLight);
    c.blit(catFrame('cat-sleep'), b.x + 4, b.y - 6);
    c.rect(b.x, b.y + 9, b.w, b.h - 9, p.food);
    c.rect(b.x, b.y + 9, b.w, 1, p.woodDark);
  }
  return c;
}

/**
 * The permanent contract (a historic milestone): a document headed PERMANENT CONTRACT, a red
 * wax seal, a confident signature, and a block of fine print nobody can read.
 */
export function permanentContract(): PixelCanvas {
  const p = light;
  const c = createCanvas(ILLUSTRATION.w, ILLUSTRATION.h);
  c.rect(0, 0, 128, 96, p.woodDark);
  c.dither(0, 0, 128, 96, p.woodDark, p.wood);
  // The document, slightly tilted by a shadow.
  c.rect(26, 6, 78, 88, p.outline);
  c.rect(24, 4, 78, 88, p.paper);
  c.rect(24, 4, 78, 1, p.star);
  // The soulless swoosh logo of Enterprise Solutions Inc.
  stroke(
    c,
    [
      [30, 14],
      [36, 10],
      [44, 12],
    ],
    1,
    p.ledBlue,
  );
  text(c, 'ESI', 48, 9, p.metalDark);
  text(c, 'PERMANENT', 30, 20, p.outline);
  text(c, 'CONTRACT', 30, 27, p.outline);
  // Fine print: a grey block of tiny lines.
  for (let y = 36; y < 72; y += 2) {
    for (let x = 30; x < 96; x += 1) if ((x * 7 + y * 3) % 5 !== 0) c.set(x, y, p.paperShade);
    for (let x = 30; x < 96; x += 3) if ((x + y) % 4 === 0) c.set(x, y, p.metalDark);
  }
  // "Until further notice", in slightly bigger fine print.
  c.rect(30, 66, 40, 1, p.metalDark);
  // The signature.
  stroke(
    c,
    [
      [32, 82],
      [36, 76],
      [40, 84],
      [44, 77],
      [50, 82],
      [58, 79],
    ],
    0,
    p.ledBlue,
  );
  c.rect(30, 86, 34, 1, p.metalDark);
  // The red wax seal, with a ribbon.
  c.rect(82, 76, 3, 14, p.ledRed);
  c.rect(88, 78, 3, 14, p.rugDark);
  c.disc(85, 76, 8, p.rugDark);
  c.disc(85, 76, 7, p.ledRed);
  c.disc(84, 75, 3, p.pink);
  outline(c, p.outline);
  return c;
}
