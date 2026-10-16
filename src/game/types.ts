export type RunStatus = 'playing' | 'ended';

/** Command union for acceptance exhaustiveness fixtures; expanded in P01. */
export type GameCommand = { type: 'feedCat' } | { type: 'petCat' };

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
