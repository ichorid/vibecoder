/** Manual-coding era illustrations: autocomplete, generated snippets, AI-native IDE. */
import { text } from '../lib/font';
import { ellipse, outline, triangle } from '../lib/shapes';
import { createCanvas } from '../lib/canvas';
import { backdrop, codeLine, motif, sparkle, type Illustration } from './common';

/** A monitor with typed code and a grey ghost suggestion; a huge TAB key below. */
export const autocomplete: Illustration = (c, p) => {
  backdrop(c, p.wall, p.floor);
  c.rect(14, 8, 100, 54, p.outline);
  c.rect(16, 10, 96, 50, p.metalDark);
  c.rect(19, 13, 90, 44, p.screen);
  const tokens = [p.code4, p.code1, p.code2];
  codeLine(c, 23, 17, [10, 18, 8], tokens);
  codeLine(c, 27, 22, [14, 10, 20], tokens);
  codeLine(c, 27, 27, [8, 24], tokens);
  // Typed part, then the ghost continuation in grey.
  codeLine(c, 27, 33, [12], [p.code2]);
  c.rect(41, 32, 1, 4, p.glow);
  codeLine(c, 43, 33, [16, 12, 10], [p.metal]);
  codeLine(c, 27, 38, [20, 14], [p.metal]);
  codeLine(c, 23, 43, [8], [p.metal]);
  text(c, 'TAB?', 82, 46, p.metal);
  c.rect(56, 60, 16, 4, p.metalDark);
  // The TAB key, large and glowing.
  c.rect(30, 68, 68, 22, p.outline);
  c.rect(32, 70, 64, 17, p.plastic);
  c.rect(32, 85, 64, 3, p.plasticDark);
  text(c, 'TAB', 52, 74, p.outline);
  triangle(c, [74, 76], [74, 82], [79, 79], p.outline);
  c.rect(68, 78, 6, 2, p.outline);
  sparkle(c, 104, 70, p.lampGlow);
  sparkle(c, 22, 72, p.lampGlow);
  sparkle(c, 110, 84, p.gold);
};

/** A comment bubble turns into bricks of code that drop into place. */
export const generatedSnippets: Illustration = (c, p) => {
  backdrop(c, p.wallLight, p.floor, 74);
  // Speech-like comment bubble.
  c.rect(6, 6, 58, 18, p.outline);
  c.rect(8, 8, 54, 14, p.paper);
  triangle(c, [18, 23], [28, 23], [16, 30], p.outline);
  triangle(c, [19, 22], [26, 22], [18, 27], p.paper);
  text(c, '// SORT', 11, 10, p.metalDark);
  text(c, '// USERS', 11, 16, p.metalDark);
  // Arrow.
  c.rect(66, 13, 14, 3, p.ledAmber);
  triangle(c, [80, 9], [80, 19], [86, 14], p.ledAmber);
  // Falling bricks of code (snippets).
  const bricks: [number, number, number, string][] = [
    [90, 4, 28, p.code4],
    [96, 14, 22, p.code1],
    [88, 24, 30, p.code2],
  ];
  for (const [x, y, w, color] of bricks) {
    c.rect(x, y, w, 8, p.outline);
    c.rect(x + 1, y + 1, w - 2, 6, color);
    c.rect(x + 3, y + 3, w - 8, 2, p.screen);
  }
  // Editor receiving them.
  c.rect(10, 38, 108, 46, p.outline);
  c.rect(12, 40, 104, 42, p.screen);
  c.rect(12, 40, 104, 5, p.metalDark);
  for (const [x, color] of [
    [15, p.ledRed],
    [20, p.ledAmber],
    [25, p.ledGreen],
  ] as const)
    c.rect(x, 41, 3, 3, color);
  for (let i = 0; i < 5; i += 1) {
    c.rect(18, 49 + i * 6, 40 + ((i * 13) % 30), 4, [p.code4, p.code1, p.code2][i % 3] ?? p.code1);
  }
  c.rect(84, 72, 26, 6, p.code3);
  sparkle(c, 112, 66, p.lampGlow);
  sparkle(c, 70, 40, p.lampGlow);
};

/** Split-pane IDE: the editor writes by itself while the human holds a mug. */
export const aiNativeIde: Illustration = (c, p) => {
  backdrop(c, p.wall, p.floorDark, 80);
  c.rect(4, 4, 120, 70, p.outline);
  c.rect(6, 6, 116, 66, p.screenDark);
  c.rect(6, 6, 116, 6, p.metalDark);
  text(c, 'IDE', 10, 7, p.metalLight);
  // File tree.
  c.rect(8, 14, 22, 56, p.screen);
  for (let i = 0; i < 8; i += 1) c.rect(10 + (i % 3) * 2, 17 + i * 6, 12, 2, p.glowDim);
  // Editor pane typing itself.
  c.rect(32, 14, 58, 56, p.screen);
  const tokens = [p.code4, p.code1, p.code2, p.code3];
  for (let i = 0; i < 9; i += 1)
    codeLine(c, 35 + (i % 3) * 3, 17 + i * 5, [8, 12 + (i % 4) * 4], tokens.slice(i % 4));
  c.rect(60, 62, 2, 4, p.glow);
  // Assistant pane with a tiny robot.
  c.rect(92, 14, 28, 56, p.screen);
  motif(c, 'agent', 97, 20, 1, p);
  for (let i = 0; i < 4; i += 1) c.rect(95, 44 + i * 5, 20 - (i % 2) * 6, 2, p.paper);
  sparkle(c, 112, 18, p.lampGlow);
  // The human hand with coffee, not typing.
  const hand = createCanvas(30, 22);
  ellipse(hand, 14, 15, 12, 5, p.hoodie);
  hand.rect(16, 6, 10, 11, p.mug);
  hand.rect(26, 9, 3, 5, p.mug);
  hand.rect(14, 12, 6, 4, p.skin);
  outline(hand, p.outline);
  c.blit(hand, 92, 72);
  c.rect(98, 74, 1, 3, p.paperShade);
  c.rect(101, 72, 1, 3, p.paperShade);
};
