export function startGameplayClock(tick: () => void): ReturnType<typeof setInterval> {
  return setInterval(tick, 100);
}
