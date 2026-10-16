/**
 * PLAY geometry. Rendering and hit detection share `mousePosition`, so what the player sees is
 * what is scored. All positions are normalized (0–1); no DOM sizes enter the simulation.
 */
import type { CatPlayBalance } from './catalog';
import { nextRange } from './random';

export interface PlayTarget {
  readonly start: number;
  readonly width: number;
}

export interface AttemptParameters {
  readonly target: PlayTarget;
  readonly speed: number;
}

export type AttemptOutcome = 'hit' | 'near' | 'miss';

/** Tolerance for floating-point edges; edges themselves count as inside. */
const EPSILON = 1e-9;

/** 0 → 1 → 0 repeating with period 2. */
export function triangleWave(x: number): number {
  const phase = ((x % 2) + 2) % 2;
  return phase <= 1 ? phase : 2 - phase;
}

/** Normalized mouse position after `elapsedMs` of movement at `speed` track lengths/s. */
export function mousePosition(speed: number, elapsedMs: number): number {
  return triangleWave((speed * Math.max(0, elapsedMs)) / 1000);
}

export function scoreAttempt(position: number, target: PlayTarget, near: number): AttemptOutcome {
  const end = target.start + target.width;
  if (position >= target.start - EPSILON && position <= end + EPSILON) return 'hit';
  const distance = position < target.start ? target.start - position : position - end;
  return distance <= near + EPSILON ? 'near' : 'miss';
}

/**
 * Sample a session's first target and speed. Later attempts are faster and narrower
 * (`nextAttempt`), so the first is slow enough that even the last crossing lasts
 * ≥ minHitWindowMs.
 */
export function sampleAttempt(
  rng: number,
  balance: CatPlayBalance,
): { attempt: AttemptParameters; rng: number } {
  const width = nextRange(rng, balance.targetWidthMin, balance.targetWidthMax);
  const start = nextRange(width.state, 0, 1 - width.value);
  const tightening =
    (balance.attemptSpeedFactor / balance.attemptWidthFactor) ** (balance.attempts - 1);
  const fairMax = Math.min(
    balance.speedMax,
    (width.value * 1000) / (balance.minHitWindowMs * tightening),
  );
  const speed = nextRange(start.state, balance.speedMin, Math.max(balance.speedMin, fairMax));
  return {
    attempt: { target: { start: start.value, width: width.value }, speed: speed.value },
    rng: speed.state,
  };
}

/** The next attempt of a session: faster, with a narrower band at a fresh position. */
export function nextAttempt(
  rng: number,
  previous: AttemptParameters,
  balance: CatPlayBalance,
): { attempt: AttemptParameters; rng: number } {
  const width = previous.target.width * balance.attemptWidthFactor;
  const start = nextRange(rng, 0, 1 - width);
  return {
    attempt: {
      target: { start: start.value, width },
      speed: previous.speed * balance.attemptSpeedFactor,
    },
    rng: start.state,
  };
}
