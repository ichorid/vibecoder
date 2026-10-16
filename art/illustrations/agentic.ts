/** Agentic-coding era illustrations. */
import { text } from '../lib/font';
import { triangle } from '../lib/shapes';
import { backdrop, codeLine, motif, sparkle, type Illustration } from './common';

/** A terminal that types by itself, fed by a slot of falling token coins. */
export const terminalAgent: Illustration = (c, p) => {
  backdrop(c, p.wallShade, p.floorDark, 78);
  c.rect(6, 16, 82, 62, p.outline);
  c.rect(8, 18, 78, 58, p.screenDark);
  c.rect(8, 18, 78, 6, p.metalDark);
  for (const [x, color] of [
    [11, p.ledRed],
    [16, p.ledAmber],
    [21, p.ledGreen],
  ] as const) {
    c.rect(x, 19, 3, 3, color);
  }
  text(c, '$ AGENT RUN', 12, 28, p.glow);
  codeLine(c, 12, 36, [6, 14, 8], [p.glowDim]);
  codeLine(c, 12, 41, [10, 6, 16], [p.glowDim]);
  codeLine(c, 12, 46, [8, 20], [p.code2, p.glowDim]);
  codeLine(c, 12, 51, [14, 10], [p.glowDim]);
  text(c, 'WORKING...', 12, 60, p.glow);
  c.rect(52, 60, 3, 5, p.glow);
  // The agent itself perched on the terminal.
  motif(c, 'agent', 30, -2, 1, p);
  // Token slot and coins.
  c.rect(96, 30, 26, 46, p.outline);
  c.rect(98, 32, 22, 42, p.metal);
  text(c, 'TOK', 103, 36, p.outline);
  c.rect(102, 44, 14, 3, p.outline);
  for (const [x, y] of [
    [104, 6],
    [111, 14],
    [102, 22],
  ] as const) {
    c.disc(x + 2, y + 2, 3, p.gold);
    c.rect(x + 2, y, 1, 4, p.ledAmber);
  }
  for (let i = 0; i < 5; i += 1) c.rect(101, 66 - i * 3, 16, 2, i < 2 ? p.ledGreen : p.metalDark);
  triangle(c, [88, 50], [88, 58], [95, 54], p.ledAmber);
  sparkle(c, 92, 10, p.lampGlow);
};

/** Edit → test → edit: a file being rewritten while a test runner flashes green. */
export const autonomousEdits: Illustration = (c, p) => {
  backdrop(c, p.wall, p.floor, 74);
  // File page with crossed-out and inserted lines.
  c.rect(8, 8, 52, 66, p.outline);
  c.rect(10, 10, 48, 62, p.paper);
  for (let i = 0; i < 9; i += 1) {
    const y = 15 + i * 6;
    const removed = i % 3 === 1;
    c.rect(14, y, 26 + ((i * 7) % 14), 2, removed ? p.ledRed : p.metalDark);
    if (removed) c.rect(12, y + 1, 32, 1, p.ledRed);
    if (i % 3 === 2) c.rect(14, y, 30, 2, p.ledGreen);
  }
  motif(c, 'agent', 44, 54, 1, p);
  // Arrows around to the test runner (the loop).
  c.rect(62, 30, 14, 3, p.ledAmber);
  triangle(c, [76, 26], [76, 36], [82, 31], p.ledAmber);
  c.rect(62, 56, 14, 3, p.ledAmber);
  triangle(c, [62, 52], [62, 62], [56, 57], p.ledAmber);
  motif(c, 'test', 86, 16, 2, p);
  text(c, 'PASS 3/4', 84, 52, p.ledGreen);
  text(c, 'DEBT +1', 86, 60, p.ledRed);
  sparkle(c, 120, 12, p.lampGlow);
};

/** A row of opened permission gates; one prompt dialog lies discarded on the floor. */
export const toolPermissions: Illustration = (c, p) => {
  backdrop(c, p.wallLight, p.floorDark, 70);
  for (let i = 0; i < 4; i += 1) {
    const x = 6 + i * 30;
    c.rect(x, 18, 4, 52, p.metalDark);
    c.rect(x + 22, 18, 4, 52, p.metalDark);
    // Gate swung open: thin edge-on bars.
    c.rect(x + 4, 22, 2, 44, p.ledGreen);
    c.rect(x + 20, 22, 2, 44, p.ledGreen);
    c.rect(x, 12, 26, 6, p.metal);
    text(c, ['RM', 'GIT', 'NET', 'SU'][i] ?? '', x + 6, 13, p.outline);
  }
  motif(c, 'agent', 54, 46, 1, p);
  // The discarded "Allow?" dialog.
  c.rect(12, 76, 44, 16, p.outline);
  c.rect(13, 77, 42, 14, p.plastic);
  text(c, 'ALLOW?', 16, 79, p.outline);
  c.rect(16, 86, 14, 3, p.ledGreen);
  c.rect(34, 86, 14, 3, p.ledRed);
  c.line(10, 74, 58, 93, p.ledRed);
  sparkle(c, 110, 80, p.gold);
};

/** A long scroll of rules unrolled over the agent's head. */
export const persistentInstructions: Illustration = (c, p) => {
  backdrop(c, p.wall, p.floor, 80);
  c.rect(30, 4, 68, 6, p.paperShade);
  c.rect(34, 10, 60, 64, p.paper);
  c.rect(30, 72, 68, 6, p.paperShade);
  text(c, 'AGENTS.MD', 44, 13, p.outline);
  const rules = ['1. BE TERSE', '2. RUN TESTS', '3. NO RM -RF', '4. BE TERSE', '5. REALLY.'];
  rules.forEach((rule, i) => text(c, rule, 38, 23 + i * 9, p.metalDark));
  motif(c, 'agent', 100, 54, 1, p);
  c.line(98, 54, 92, 46, p.metalDark);
  motif(c, 'scroll', 8, 52, 1, p);
  motif(c, 'scroll', 14, 30, 1, p);
};

/** An agent running in a circle on a treadmill loop, tasks dropping in endlessly. */
export const ralphLoop: Illustration = (c, p) => {
  backdrop(c, p.wallShade, p.floor, 76);
  for (let a = 0; a < 120; a += 1) {
    const angle = (a / 120) * Math.PI * 2;
    for (const r of [30, 31, 32]) {
      c.set(
        64 + Math.round(Math.cos(angle) * r),
        46 + Math.round(Math.sin(angle) * (r * 0.75)),
        p.ledAmber,
      );
    }
  }
  triangle(c, [92, 40], [100, 40], [96, 48], p.ledRed);
  triangle(c, [28, 52], [36, 52], [32, 44], p.ledRed);
  motif(c, 'agent', 55, 34, 1, p);
  text(c, 'WHILE TRUE', 44, 4, p.outline);
  for (const [x, y] of [
    [20, 14],
    [100, 10],
    [110, 66],
    [14, 70],
  ] as const)
    motif(c, 'packet', x, y, 2, p);
  text(c, 'DONE? NO.', 46, 84, p.ledRed);
};

/** A giant reviewing eye over a pull request with an approval stamp on its own code. */
export const reviewer: Illustration = (c, p) => {
  backdrop(c, p.wallLight, p.floorDark, 72);
  motif(c, 'reviewer', 34, 2, 3, p);
  c.rect(16, 52, 96, 36, p.outline);
  c.rect(18, 54, 92, 32, p.paper);
  text(c, 'PR #4096', 22, 57, p.outline);
  codeLine(c, 22, 66, [20, 10, 14], [p.ledGreen]);
  codeLine(c, 22, 71, [12, 22], [p.ledRed]);
  codeLine(c, 22, 76, [26, 8], [p.ledGreen]);
  // Approval stamp.
  c.frame(74, 64, 32, 14, p.ledGreen);
  c.frame(75, 65, 30, 12, p.ledGreen);
  text(c, 'LGTM', 82, 68, p.ledGreen);
  sparkle(c, 112, 10, p.lampGlow);
};
