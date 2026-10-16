/** Infrastructure era illustrations (13–17). */
import { text } from '../lib/font';
import { triangle } from '../lib/shapes';
import { backdrop, codeLine, motif, sparkle, type Illustration } from './common';

/** A context window as a box; old lines fall out of the bottom into a bin. */
export const contextManagement: Illustration = (c, p) => {
  backdrop(c, p.wall, p.floor, 80);
  c.rect(34, 6, 60, 62, p.outline);
  c.rect(36, 8, 56, 58, p.screen);
  text(c, '128K', 52, 10, p.glow);
  for (let i = 0; i < 8; i += 1)
    codeLine(c, 40, 18 + i * 6, [10 + ((i * 5) % 18), 8], [p.code1, p.code4]);
  // Forgotten lines tumbling out.
  for (let i = 0; i < 3; i += 1) c.rect(44 + i * 12, 72 + i * 4, 14, 2, p.metal);
  c.rect(40, 86, 48, 8, p.metalDark);
  text(c, 'FORGET', 50, 87, p.paper);
  motif(c, 'agent', 100, 30, 1, p);
  sparkle(c, 18, 20, p.lampGlow);
};

/** Rows of glowing memory chips, a tiny diary page stuck between them. */
export const persistentMemory: Illustration = (c, p) => {
  backdrop(c, p.wallShade, p.floorDark, 84);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 2; col += 1)
      motif(c, 'memory', 10 + col * 58, 10 + row * 24, 2, p, (row + col) % 2);
  }
  c.rect(52, 70, 26, 18, p.paper);
  text(c, 'DAY 1', 54, 72, p.metalDark);
  text(c, 'SAME', 56, 80, p.metalDark);
};

/** One router splitting requests into a cheap and an expensive model, with a price tag. */
export const modelRouting: Illustration = (c, p) => {
  backdrop(c, p.wallLight, p.floor, 76);
  motif(c, 'router', 46, 34, 2, p);
  c.line(46, 46, 16, 20, p.ledGreen);
  c.line(90, 46, 112, 20, p.ledRed);
  c.rect(4, 6, 26, 14, p.outline);
  c.rect(5, 7, 24, 12, p.ledGreen);
  text(c, '$', 15, 10, p.outline);
  c.rect(98, 6, 26, 14, p.outline);
  c.rect(99, 7, 24, 12, p.ledRed);
  text(c, '$$$', 104, 10, p.outline);
  for (const x of [20, 40, 60, 80, 100]) motif(c, 'packet', x, 80, 1, p);
  text(c, 'ROUTE', 50, 86, p.outline);
};

/** A press squeezing a fat prompt into a thin one; token coins come out cheaper. */
export const tokenOptimization: Illustration = (c, p) => {
  backdrop(c, p.wall, p.floorDark, 82);
  c.rect(20, 6, 88, 8, p.metalDark);
  c.rect(60, 14, 8, 18, p.metal);
  c.rect(30, 32, 68, 8, p.metalDark);
  // Squeezed prompt.
  c.rect(30, 44, 68, 6, p.paper);
  text(c, 'PLS FIX', 44, 45, p.metalDark);
  c.rect(30, 50, 68, 22, p.plasticDark);
  for (let i = 0; i < 4; i += 1) c.disc(36 + i * 18, 80, 4, p.gold);
  triangle(c, [108, 60], [108, 70], [116, 65], p.ledGreen);
  text(c, '-40%', 92, 84, p.ledGreen);
};

/** A server rack in a spare room, the cat curled on top in the warmth. */
export const localServers: Illustration = (c, p) => {
  backdrop(c, p.wall, p.floor, 78);
  for (let i = 0; i < 3; i += 1) motif(c, 'server', 18 + i * 34, 14, 2, p, i % 2);
  // Heat wiggles.
  for (let i = 0; i < 6; i += 1) c.set(30 + i * 14, 8 - (i % 2), p.ledRed);
  // A sleeping orange blob on top of the middle rack.
  c.rect(58, 10, 14, 4, p.cat);
  c.rect(70, 8, 4, 4, p.cat);
  c.set(71, 7, p.cat);
  sparkle(c, 112, 70, p.lampGlow);
};
