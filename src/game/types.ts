import type { TechnologyId } from './ids';

export type RunStatus = 'playing' | 'ended';

/** Recursively read-only view used by selectors, predicates, and store subscribers. */
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export interface RngStreams {
  economy: number;
  cat: number;
  narrative: number;
}

export interface EconomyState {
  output: number;
  /** Manual work queued by accepted commands since the previous step; consumed once. */
  pendingManualWork: number;
}

export interface RunStats {
  lifetimeOutput: number;
}

export interface CatState {
  health: number;
  mood: number;
  fullness: number;
  overfeeding: number;
  alive: boolean;
  diedAtActiveMs: number | null;
}

export type HistoryEntry = { kind: 'event'; textId: string; activeMs: number };

export interface RunState {
  id: string;
  status: RunStatus;
  /** Total active gameplay time of this run, in ms. Never derived from wall-clock time. */
  activeMs: number;
  rng: RngStreams;
  /** Constant seed for seeded presentation patterns; never consumed by gameplay. */
  visualSeed: number;
  economy: EconomyState;
  stats: RunStats;
  cat: CatState;
  history: HistoryEntry[];
  unlockedTechnologyIds: TechnologyId[];
  pendingUnlockIds: TechnologyId[];
  ending: null;
}

export type ReadonlyRun = DeepReadonly<RunState>;

export type GameCommand = { type: 'primaryAction' };

/** Typed facts returned with a transition for app wiring (saving, presentation). No event bus. */
export type GameFact = never;

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
