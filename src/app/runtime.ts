/**
 * The single owner of gameplay time. It converts monotonic elapsed time into fixed 100 ms
 * simulation steps while the game is active; it contains no game rules.
 */
export const STEP_MS = 100;
/** A larger scheduling gap is treated as suspension and discarded rather than caught up. */
export const MAX_GAP_MS = 1000;

export type PauseReason = 'hidden' | 'blurred' | 'frozen' | 'loading' | 'graphics';

export interface MonotonicClock {
  now(): number;
}

export interface IntervalScheduler {
  setInterval(callback: () => void, ms: number): number;
  clearInterval(handle: number): void;
}

export interface RuntimeOptions {
  clock: MonotonicClock;
  scheduler: IntervalScheduler;
  /** Called with the number of fixed steps that became due. */
  onSteps: (count: number) => void;
}

export interface GameRuntime {
  start(): void;
  /** Convert all eligible elapsed time into steps now. Idempotent for one timestamp. */
  settle(): void;
  pause(reason: PauseReason): void;
  resume(reason: PauseReason): void;
  isActive(): boolean;
  /** Eligible active time not yet consumed by a whole step. */
  remainderMs(): number;
  /** Remainder plus eligible time since the last settle (for presentation between steps). */
  pendingMs(): number;
  /** How long ago a monotonic event timestamp was, clamped to the current active interval. */
  inputLagMs(eventTime: number): number;
  dispose(): void;
}

export function createRuntime({ clock, scheduler, onSteps }: RuntimeOptions): GameRuntime {
  const pauseReasons = new Set<PauseReason>();
  let started = false;
  let disposed = false;
  let timer: number | null = null;
  let baseline: number | null = null;
  let remainder = 0;
  let intervalStart: number | null = null;

  const active = () => started && !disposed && pauseReasons.size === 0;

  function readNow(): number | null {
    const now = clock.now();
    return Number.isFinite(now) ? now : null;
  }

  function settle(): void {
    if (!active()) return;
    const now = readNow();
    if (now === null) return;
    if (baseline === null) {
      baseline = now;
      return;
    }
    const delta = now - baseline;
    baseline = now;
    if (delta <= 0 || delta > MAX_GAP_MS) return;
    remainder += delta;
    const steps = Math.floor(remainder / STEP_MS);
    remainder -= steps * STEP_MS;
    if (steps > 0) onSteps(steps);
  }

  function rebaseline(): void {
    baseline = readNow();
    intervalStart = baseline;
  }

  return {
    start() {
      if (started || disposed) return;
      started = true;
      rebaseline();
      timer = scheduler.setInterval(settle, STEP_MS);
    },
    settle,
    pause(reason) {
      settle();
      pauseReasons.add(reason);
    },
    resume(reason) {
      if (!pauseReasons.delete(reason)) return;
      if (active()) rebaseline();
    },
    isActive: active,
    remainderMs: () => remainder,
    pendingMs() {
      if (!active() || baseline === null) return remainder;
      const now = readNow();
      if (now === null) return remainder;
      const delta = now - baseline;
      return delta > 0 && delta <= MAX_GAP_MS ? remainder + delta : remainder;
    },
    inputLagMs(eventTime) {
      const now = readNow();
      if (now === null || !Number.isFinite(eventTime) || intervalStart === null) return 0;
      return Math.min(Math.max(0, now - eventTime), Math.max(0, now - intervalStart), MAX_GAP_MS);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (timer !== null) scheduler.clearInterval(timer);
      timer = null;
    },
  };
}

/** The browser's interval API; the only gameplay timer installation point. */
export const browserScheduler: IntervalScheduler = {
  setInterval: (callback, ms) => window.setInterval(callback, ms),
  clearInterval: (handle) => window.clearInterval(handle),
};

export const browserClock: MonotonicClock = { now: () => performance.now() };
