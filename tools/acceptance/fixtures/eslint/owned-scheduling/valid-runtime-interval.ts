// Simulated src/app/runtime.ts — gameplay timer owner
export function startGameplayClock(tick: () => void): ReturnType<typeof setInterval> {
  return setInterval(tick, 100);
}
