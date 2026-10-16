/** Orchestration era illustrations. */
import { text } from '../lib/font';
import { triangle } from '../lib/shapes';
import { backdrop, motif, sparkle, type Illustration } from './common';

/** Three agents grabbing the same file at once. */
export const parallelAgents: Illustration = (c, p) => {
  backdrop(c, p.wall, p.floor, 76);
  c.rect(52, 30, 24, 30, p.outline);
  c.rect(54, 32, 20, 26, p.paper);
  text(c, 'APP', 58, 34, p.outline);
  for (let i = 0; i < 4; i += 1) c.rect(57, 42 + i * 4, 14 - (i % 2) * 4, 2, p.metalDark);
  motif(c, 'agent', 14, 8, 2, p);
  motif(c, 'agent', 84, 8, 2, p);
  motif(c, 'agent', 46, 62, 2, p);
  c.line(44, 30, 54, 40, p.ledRed);
  c.line(86, 30, 74, 40, p.ledRed);
  c.line(64, 62, 64, 58, p.ledRed);
  text(c, '!', 48, 22, p.ledRed);
  text(c, '!', 80, 22, p.ledRed);
};

/** One repository splitting into parallel lines, each with an agent; they meet at a knot. */
export const worktrees: Illustration = (c, p) => {
  backdrop(c, p.wallLight, p.floorDark, 82);
  const colors = [p.code4, p.code1, p.code2, p.code3];
  colors.forEach((color, i) => {
    const y = 16 + i * 16;
    c.rect(20, 46, 8, 3, p.metalDark);
    c.line(28, 47, 40, y + 1, color);
    c.rect(40, y, 60, 3, color);
    c.line(100, y + 1, 114, 47, color);
    c.disc(60 + i * 8, y + 1, 2, p.outline);
  });
  c.disc(18, 47, 5, p.metalDark);
  // The eventual merge knot.
  for (let i = 0; i < 6; i += 1) c.line(110, 40 + i * 2, 124, 54 - i * 2, p.ledRed);
  text(c, 'MERGE?', 92, 84, p.ledRed);
  motif(c, 'node', 8, 70, 1, p);
};

/** A crowned manager bot pointing at a board of agents, with you approving it. */
export const managerAgent: Illustration = (c, p) => {
  backdrop(c, p.wall, p.floor, 78);
  c.rect(58, 6, 64, 46, p.outline);
  c.rect(60, 8, 60, 42, p.panel);
  text(c, 'SPRINT', 72, 10, p.outline);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      c.rect(
        64 + col * 19,
        20 + row * 9,
        15,
        6,
        [p.code4, p.code2, p.ledGreen][(row + col) % 3] ?? p.paper,
      );
    }
  }
  motif(c, 'manager', 10, 20, 2, p);
  c.line(50, 34, 62, 26, p.outline);
  // Tiny human thumbs-up stamp.
  c.rect(96, 62, 20, 18, p.outline);
  c.rect(97, 63, 18, 16, p.paper);
  c.rect(103, 66, 5, 9, p.skin);
  c.rect(101, 70, 3, 5, p.skin);
  text(c, 'OK', 98, 82, p.ledGreen);
  triangle(c, [48, 70], [56, 70], [52, 64], p.gold);
  sparkle(c, 52, 58, p.lampGlow);
};
