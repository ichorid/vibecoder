// Simulated src/game/step.ts — elapsed ms and rng arrive as arguments
export function step(elapsedMs: number, roll: number): number {
  return elapsedMs + roll;
}
