/** The ta-da of a completion (docs/feature_build_deck.md §8.1): presentation only. */
import type { MomentTier } from '../game/deck';

/** One ta-da (docs/feature_build_deck.md §8.1). */
export interface Burst {
  readonly id: number;
  readonly tier: MomentTier;
  /** What was built ("+20 % code", "v0.3 IS READY"); empty: particles only. */
  readonly text: string;
  /** Where the particles start, 0–1 of the overlay (tier A: the build row; B: the money). */
  readonly x: number;
  readonly y: number;
}

export interface Particle {
  readonly dx: number;
  readonly dy: number;
  readonly delay: number;
  readonly color: string;
  readonly size: number;
  readonly x: number;
  readonly y: number;
}

const FIREWORK = ['#ffe066', '#ff5a4e', '#59b7ff', '#7cdb6a', '#ff9de2', '#ffffff'];
const CONFETTI = ['#ffe066', '#ff5a4e', '#59b7ff', '#7cdb6a', '#c39bff'];
const COINS = ['#ffc62a', '#ffe066', '#e0a400'];

/** The particles of one burst (presentation only; not seeded, never part of the game). */
export function particles(burst: Burst): Particle[] {
  const out: Particle[] = [];
  const pick = (list: readonly string[]) => list[Math.floor(Math.random() * list.length)] ?? '#fff';
  if (burst.tier === 'S') {
    // Fireworks: a few bursts over the world, one after another.
    for (let b = 0; b < 4; b += 1) {
      const x = 0.2 + Math.random() * 0.6;
      const y = 0.15 + Math.random() * 0.4;
      for (let i = 0; i < 18; i += 1) {
        const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
        const speed = 60 + Math.random() * 50;
        out.push({
          x,
          y,
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed,
          delay: b * 260,
          color: pick(FIREWORK),
          size: 4 + Math.round(Math.random() * 2),
        });
      }
    }
  } else if (burst.tier === 'A') {
    // Confetti from the build row, up into the world.
    for (let i = 0; i < 26; i += 1) {
      out.push({
        x: burst.x,
        y: burst.y,
        dx: (Math.random() - 0.5) * 240,
        dy: -(110 + Math.random() * 150),
        delay: Math.random() * 120,
        color: pick(CONFETTI),
        size: 4 + Math.round(Math.random() * 3),
      });
    }
  } else {
    // Coins around the money.
    for (let i = 0; i < 12; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      out.push({
        x: burst.x,
        y: burst.y,
        dx: Math.cos(angle) * (30 + Math.random() * 40),
        dy: Math.sin(angle) * (20 + Math.random() * 30) + 10,
        delay: Math.random() * 100,
        color: pick(COINS),
        size: 5,
      });
    }
  }
  return out;
}
