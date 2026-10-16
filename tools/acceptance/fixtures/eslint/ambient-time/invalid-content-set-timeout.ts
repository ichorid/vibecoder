// Simulated src/content/delay.ts
export function later(fn: () => void): void {
  setTimeout(fn, 0);
}
