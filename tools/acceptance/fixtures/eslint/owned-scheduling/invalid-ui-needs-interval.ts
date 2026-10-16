// Simulated src/ui/CatView.svelte.ts
export function startNeedsPolling(tick: () => void): void {
  setInterval(tick, 5000);
}
