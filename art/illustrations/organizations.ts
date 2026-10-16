/** Autonomous organization illustrations (23–28). */
import { text } from '../lib/font';
import { triangle } from '../lib/shapes';
import { backdrop, motif, sparkle, type Illustration } from './common';

/** Repositories driving themselves along a pipeline with no one at the wheel. */
export const selfDrivingRepositories: Illustration = (c, p) => {
  backdrop(c, p.wallLight, p.floorDark, 70);
  motif(c, 'pipeline', 4, 30, 3, p);
  for (let i = 0; i < 3; i += 1) {
    const x = 10 + i * 40;
    c.rect(x, 74, 28, 12, p.ledBlue);
    c.rect(x + 4, 70, 18, 6, p.skyLight);
    c.disc(x + 6, 87, 3, p.outline);
    c.disc(x + 22, 87, 3, p.outline);
    text(c, 'GIT', x + 8, 77, p.paper);
  }
  text(c, 'NO DRIVER', 40, 8, p.ledRed);
};

/** A roadmap node with sticky notes deciding what the product is. */
export const productManagement: Illustration = (c, p) => {
  backdrop(c, p.wall, p.floor, 82);
  c.rect(10, 6, 108, 60, p.outline);
  c.rect(12, 8, 104, 56, p.panel);
  const notes = [p.lampGlow, p.code3, p.skyLight, p.ledGreen, p.lampGlow, p.code2];
  notes.forEach((color, i) =>
    c.rect(16 + (i % 3) * 34, 14 + Math.floor(i / 3) * 24, 26, 18, color),
  );
  text(c, 'Q1', 22, 18, p.outline);
  text(c, '$$$', 54, 18, p.outline);
  text(c, 'AI', 90, 18, p.outline);
  motif(c, 'chart', 54, 70, 1, p);
};

/** Megaphones shouting at megaphones. */
export const marketing: Illustration = (c, p) => {
  backdrop(c, p.wallLight, p.floor, 84);
  motif(c, 'megaphone', 6, 30, 2, p, 1);
  motif(c, 'megaphone', 74, 14, 2, p, 1);
  motif(c, 'megaphone', 74, 52, 2, p, 1);
  text(c, 'BUY!', 48, 8, p.ledRed);
  text(c, 'NOW!', 50, 80, p.ledRed);
  sparkle(c, 120, 44, p.gold);
};

/** A ledger with costs and revenue, a robot hand holding the company card. */
export const finance: Illustration = (c, p) => {
  backdrop(c, p.wall, p.floorDark, 82);
  c.rect(8, 8, 70, 74, p.outline);
  c.rect(10, 10, 66, 70, p.paper);
  text(c, 'REVENUE', 14, 14, p.ledGreen);
  text(c, 'COSTS', 14, 34, p.ledRed);
  text(c, 'MARGIN', 14, 56, p.outline);
  c.rect(14, 22, 50, 3, p.ledGreen);
  c.rect(14, 42, 40, 3, p.ledRed);
  c.rect(14, 64, 10, 3, p.outline);
  c.rect(88, 40, 34, 22, p.gold);
  c.rect(88, 46, 34, 4, p.outline);
  motif(c, 'agent', 96, 14, 1, p);
};

/** A boardroom table of identical executive bots; one empty chair. */
export const executiveAgents: Illustration = (c, p) => {
  backdrop(c, p.wallShade, p.floorDark, 76);
  c.rect(6, 56, 116, 10, p.woodDark);
  for (let i = 0; i < 4; i += 1) motif(c, 'executive', 8 + i * 22, 30, 1, p, i % 2);
  // The empty chair.
  c.rect(100, 36, 16, 20, p.chair);
  c.rect(100, 36, 16, 3, p.chairDark);
  text(c, 'HUMAN?', 92, 70, p.ledRed);
  triangle(c, [60, 4], [68, 4], [64, 10], p.gold);
};

/** An immense lattice of nodes. Somewhere in it, a single orange pixel. */
export const autonomousCompany: Illustration = (c, p) => {
  backdrop(c, p.screenDark, p.screenDark, 95);
  for (let y = 6; y < 92; y += 8) {
    for (let x = 4; x < 126; x += 8) {
      const on = (x * 7 + y * 3) % 5 !== 0;
      c.set(x, y, on ? p.teal : p.violet);
      if (on && (x + y) % 16 === 0) c.line(x, y, x + 8, y + 8, p.panelDark);
    }
  }
  c.set(77, 53, p.cat);
  text(c, 'RUNNING', 46, 88, p.glow);
};
