/** Manually advanced monotonic clock for runtime tests; no real waiting. */
export interface FakeClock {
  now(): number;
  advance(ms: number): void;
  set(ms: number): void;
}

export function createFakeClock(start = 1000): FakeClock {
  let current = start;
  return {
    now: () => current,
    advance(ms) {
      current += ms;
    },
    set(ms) {
      current = ms;
    },
  };
}

/** Interval scheduler that records installed timers so tests can fire or count them. */
export interface FakeScheduler {
  setInterval(callback: () => void, ms: number): number;
  clearInterval(handle: number): void;
  activeCount(): number;
  fire(): void;
}

export function createFakeScheduler(): FakeScheduler {
  const timers = new Map<number, () => void>();
  let nextHandle = 1;
  return {
    setInterval(callback) {
      const handle = nextHandle;
      nextHandle += 1;
      timers.set(handle, callback);
      return handle;
    },
    clearInterval(handle) {
      timers.delete(handle);
    },
    activeCount: () => timers.size,
    fire() {
      for (const callback of [...timers.values()]) callback();
    },
  };
}
