// Simulated src/game/crypto-leak.ts
export function bytes(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(4));
}
