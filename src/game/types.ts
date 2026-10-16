import type {
  ChoiceId,
  EndingId,
  ReleaseOutcomeId,
  ReleaseWindow,
  TechnologyId,
  UpgradeId,
} from './ids';

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
  /** Consumed only by shipping releases, so outcomes never depend on timing. */
  release: number;
}

export interface EconomyState {
  output: number;
  /** Manual work queued by accepted commands since the previous step; consumed once. */
  pendingManualWork: number;
  /** Token stock consumed by agent work. */
  tokens: number;
  /** Queued agent work in agent-seconds (supplied by PROMPT and later automation). */
  tasks: number;
  /** Primary-action budget (refills each step, capped). */
  actionCharges: number;
  /** Accumulated technical debt; lowers quality efficiency, removed by review. */
  debt: number;
  /** Temporary extra managed capacity from DELEGATE (bounded, decays). */
  delegation: number;
  /** Temporary efficiency from OPTIMIZE (bounded, decays). */
  optimization: number;
  /** Spendable revenue (never negative). */
  revenue: number;
  /** Revenue earned and operating costs over the last step, per second (for margin). */
  revenuePerSecond: number;
  costPerSecond: number;
  /** Packs bought by auto-refill v1 (its bug schedule counts these). */
  autoRefills: number;
  /** Permanent tokens-per-code bonus earned by the auto-reviewer (fraction, capped). */
  tokenReviewBonus: number;
  /** Active time accumulated toward the next auto-review. */
  autoReviewMs: number;
  /** Tokens per second the agents would burn at full capacity (set by each economy step). */
  tokenDemandPerSecond: number;
}

export interface RunStats {
  lifetimeOutput: number;
  /** Care counts: narrative/achievement/ending facts only, never production inputs. */
  feeds: number;
  pets: number;
  playHits: number;
  /** Accepted primary presses (with a charge) over the run. */
  manualActions: number;
  /** Continuous active time with debt ≤ 5 / margin > 0 / margin < 0 (ending conditions). */
  lowDebtMs: number;
  positiveMarginMs: number;
  negativeMarginMs: number;
  /** Times auto-refill v1 spent code on tokens that never arrived. */
  refillDisasters: number;
}

/** Last accepted care, for contextual Cat messages; cosmetic responses are not stored. */
export type CareNote =
  'nom' | 'notHungry' | 'tooMuch' | 'spherical' | 'purr' | 'playWin' | 'playLose';

export interface CatState {
  health: number;
  mood: number;
  fullness: number;
  overfeeding: number;
  /** False once the cat is gone from the run: dead (`diedAtActiveMs`) or a stray (`leftAtActiveMs`). */
  alive: boolean;
  diedAtActiveMs: number | null;
  /** When a neglected cat left without a word to become a stray; it never comes back. */
  leftAtActiveMs: number | null;
  /** Continuous active time spent asking for attention while strong enough to walk out. */
  ignoredMs: number;
  /** Active time accumulated toward the next needs tick. */
  needsElapsedMs: number;
  /** Meaningful player actions since the last needs tick (capped decay modifier). */
  pendingActions: number;
  lastFedAtActiveMs: number | null;
  lastPetAtActiveMs: number | null;
  lastCare: { note: CareNote; atActiveMs: number } | null;
}

export const CAT_HISTORY_IDS = ['cat-died', 'cat-left'] as const;
export type CatHistoryId = (typeof CAT_HISTORY_IDS)[number];

export type HistoryEntry =
  | { kind: 'technology'; id: TechnologyId; activeMs: number }
  | { kind: 'cat'; id: CatHistoryId; activeMs: number }
  | { kind: 'event'; textId: string; activeMs: number }
  | { kind: 'achievement'; id: string; activeMs: number }
  | { kind: 'ending'; id: EndingId; activeMs: number }
  | { kind: 'release'; window: ReleaseWindow; outcome: ReleaseResult; activeMs: number };

export interface PlantState {
  /** 0 = bone dry; above the drown line it rots. */
  water: number;
  alive: boolean;
  diedAtActiveMs: number | null;
  cause: 'drowned' | 'dried' | null;
  /** The thirsty warning was already logged since the last watering. */
  warned: boolean;
}

/** What the release wheel landed on: a silly slice or the gold one. */
export type ReleaseResult = ReleaseOutcomeId | 'jackpot';

/** One shipped release; its texts never recompute the cat's state later. */
export interface ReleaseRecord {
  window: ReleaseWindow;
  outcome: ReleaseResult;
  /** The top comment shown under the result (null for the jackpot). */
  commentId: string | null;
  /** Whether the cat was there when it shipped. */
  catAlive: boolean;
  activeMs: number;
}

/** A committed decision with the facts later conditions need. */
export interface ChoiceRecord {
  atActiveMs: number;
  /** Accepted manual presses when the choice was made (for "after the choice" counts). */
  manualActions: number;
  /** Fixed extra operating cost per second committed by this choice (0 if none). */
  overhead: number;
}

/** A profile record of an ending discovered in some run (survives restarts). */
export interface DiscoveredEnding {
  id: EndingId;
  runId: string;
  /** Active time of that run when the ending happened. */
  activeMs: number;
  /** First-discovery order across runs (1, 2, …). */
  order: number;
}

export interface EndingRecord {
  id: EndingId;
  /** The cat's fate when the run ended; ending text never recomputes it later. */
  catAlive: boolean;
  /** The cat had left as a stray (`catAlive` is then false, but it did not die). */
  catLeft: boolean;
  activeMs: number;
}

export type AttemptOutcomeKind = 'hit' | 'near' | 'miss';

/** One PLAY session: three attempts on the shared active clock. */
export interface CatPlayState {
  attemptNumber: number;
  /** Unique within the run; stale or repeated input for another ID is rejected. */
  attemptId: number;
  attemptStartMs: number;
  /** Movement time origin; shifted forward by a resume cue so the mouse never jumps. */
  movementOriginMs: number;
  movementEndMs: number;
  attemptEndMs: number;
  /** While set and in the future, the attempt shows a frozen ready cue. */
  cueUntilMs: number | null;
  target: { start: number; width: number };
  speed: number;
  outcome: { kind: AttemptOutcomeKind; moodGain: number; atMs: number; position: number } | null;
  previous: AttemptOutcomeKind[];
}

export type AttentionLevel = 'small' | 'large';

/** Active-time schedule of foreground cat intrusions; presentation reads it, never decides it. */
export interface AttentionState {
  nextAtMs: number | null;
  visibleUntilMs: number | null;
  level: AttentionLevel | null;
  /** Number of intrusions so far (seeds cosmetic placement). */
  count: number;
}

export interface LogEntry {
  text: string;
  activeMs: number;
}

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
  /** Bounded recent flavor/event lines; significant records live in `history`. */
  log: LogEntry[];
  unlockedTechnologyIds: TechnologyId[];
  upgradeLevels: Partial<Record<UpgradeId, number>>;
  achievementIds: string[];
  pendingUnlockIds: TechnologyId[];
  catPlay: CatPlayState | null;
  /** Which narrative events fired, and when each repeating one last fired. */
  narrative: { fired: string[]; lastAt: Record<string, number> };
  attention: AttentionState;
  /** Last issued PLAY attempt ID. */
  catPlaySeq: number;
  choices: Partial<Record<ChoiceId, ChoiceRecord>>;
  /** Shipped releases, in ship order. */
  releases: ReleaseRecord[];
  /** The corner plant: watered too often it drowns, too rarely it dries out. */
  plant: PlantState;
  ending: EndingRecord | null;
}

export type ReadonlyRun = DeepReadonly<RunState>;

export type GameCommand =
  | { type: 'primaryAction' }
  | { type: 'buyUpgrade'; id: UpgradeId }
  | { type: 'acknowledgeUnlock'; id: TechnologyId }
  | { type: 'shipRelease' }
  | { type: 'waterPlant' }
  | { type: 'feedCat' }
  | { type: 'petCat' }
  | { type: 'startCatPlay' }
  | { type: 'catchMouse'; attemptId: number }
  | { type: 'leaveCatPlay' }
  | { type: 'resumeCatPlay' }
  | { type: 'choose'; id: ChoiceId };

/** Typed facts returned with a transition for app wiring (saving, presentation). No event bus. */
export type GameFact =
  | { type: 'endingReached'; id: EndingId }
  | { type: 'choiceMade'; id: ChoiceId }
  | { type: 'catDied' }
  | { type: 'catLeft' }
  | { type: 'releaseShipped'; window: ReleaseWindow; outcome: ReleaseResult }
  | { type: 'catCared'; kind: 'feed' | 'pet' | 'play' }
  | { type: 'purchased'; id: UpgradeId }
  | { type: 'technologyDiscovered'; id: TechnologyId };

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
