/** Recursive automation illustrations (18–22). */
import { text } from '../lib/font';
import { backdrop, motif, sparkle, type Illustration } from './common';

/** A frame bolting together tools, memory, context and a runner. */
export const customHarness: Illustration = (c, p) => {
  backdrop(c, p.wallShade, p.floor, 84);
  c.frame(6, 6, 116, 74, p.outline);
  c.frame(7, 7, 114, 72, p.metal);
  c.frame(8, 8, 112, 70, p.outline);
  motif(c, 'gear', 16, 16, 2, p);
  motif(c, 'memory', 64, 18, 2, p);
  motif(c, 'terminal', 16, 48, 1, p);
  motif(c, 'agent', 70, 50, 1, p);
  for (const [x, y] of [
    [8, 8],
    [116, 8],
    [8, 74],
    [116, 74],
  ] as const)
    c.rect(x, y, 4, 4, p.ledAmber);
  text(c, 'HARNESS V0.1', 30, 86, p.outline);
};

/** Frames inside frames inside frames. */
export const metaHarness: Illustration = (c, p) => {
  backdrop(c, p.wall, p.floorDark, 88);
  for (let i = 0; i < 6; i += 1) {
    c.frame(4 + i * 9, 4 + i * 7, 120 - i * 18, 82 - i * 14, i % 2 === 0 ? p.outline : p.violet);
  }
  motif(c, 'manager', 54, 34, 1, p);
  text(c, 'META', 54, 88, p.outline);
};

/** A wall of evaluation dials, all pinned at 100%. */
export const evaluations: Illustration = (c, p) => {
  backdrop(c, p.wallLight, p.floor, 80);
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 3; col += 1) motif(c, 'gauge', 8 + col * 40, 6 + row * 34, 2, p, 1);
  }
  c.rect(16, 78, 96, 12, p.outline);
  c.rect(17, 79, 94, 10, p.paper);
  text(c, 'SCORE 100/100', 22, 82, p.ledGreen);
};

/** Gears driving gears; a tiny receipt says "saved $0.03". */
export const workflowOptimization: Illustration = (c, p) => {
  backdrop(c, p.wall, p.floorDark, 82);
  motif(c, 'gear', 10, 10, 3, p);
  motif(c, 'gear', 52, 28, 2, p, 1);
  motif(c, 'gear', 84, 8, 2, p);
  c.rect(84, 60, 36, 26, p.paper);
  text(c, 'COST $400', 86, 63, p.metalDark);
  text(c, 'SAVED', 86, 71, p.metalDark);
  text(c, '$0.03', 90, 79, p.ledGreen);
  sparkle(c, 30, 76, p.lampGlow);
};

/** A glowing core holding a wrench and fixing itself, arrows looping back into it. */
export const selfImprovement: Illustration = (c, p) => {
  backdrop(c, p.screenDark, p.screen, 90);
  motif(c, 'core', 38, 14, 2, p);
  for (let a = 0; a < 100; a += 1) {
    const angle = (a / 100) * Math.PI * 2;
    if (a % 25 < 20)
      c.set(64 + Math.round(Math.cos(angle) * 48), 40 + Math.round(Math.sin(angle) * 36), p.code3);
  }
  c.rect(96, 52, 14, 3, p.metalLight);
  c.rect(108, 48, 4, 10, p.metalLight);
  text(c, 'V2 -> V3', 44, 84, p.glow);
};
