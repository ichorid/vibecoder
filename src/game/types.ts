import type {
  ChoiceId,
  EndingId,
  ReleaseOutcomeId,
  RentOutcomeId,
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
  /** Consumed only by coding demos: one seed per demo. */
  demo: number;
  /** Gigs and the enterprise job: offers, searches, pay, layoffs. */
  gigs: number;
  /** Consumed only by missed rent (the landlord wheel). */
  rent: number;
}

export interface EconomyState {
  /** Code per second, smoothed over a few seconds (ETAs, gig sizes, salaries). */
  codeRate: number;
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
  /** The player's money: gigs, salary and (later) company revenue. Negative = debt. */
  money: number;
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
  /** Times auto-refill v1 spent money on tokens that never arrived. */
  refillDisasters: number;
  /** Code lost to the fallback tax and to polish (never built into anything). */
  taxedCode: number;
  /** Code built into gigs (it became money). */
  gigCode: number;
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
  | { kind: 'release'; window: ReleaseWindow; outcome: ReleaseResult; activeMs: number }
  | { kind: 'demo'; number: number; activeMs: number }
  | { kind: 'market'; era: number; activeMs: number }
  | { kind: 'job'; event: 'hired' | 'fired'; activeMs: number }
  | { kind: 'milestone'; id: MilestoneId; activeMs: number }
  | { kind: 'money'; id: 'moved-out' | 'company-pays-rent'; activeMs: number };

export type MilestoneId = 'permanent-contract';

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

/**
 * One coded demo. Only the seed is stored: the picture (a lineage of mutated horn genomes, see
 * src/demo/) and its texts are derived from the seeds of this and the earlier demos.
 */
export interface DemoRecord {
  /** 1-based, in making order. */
  number: number;
  seed: number;
  /** The variant the player designed it as (0–2, 3 = mystery), or null: the judge chose. */
  pick: number | null;
  /** Whether the cat was there (its greeting changes). */
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

/** Anything code can be built into (docs/feature_projects.md §5.1). */
export type ProjectKey = UpgradeId | 'release' | 'demo' | 'gig' | 'job';

/** Code built into a project so far; the price is frozen when its first code arrives. */
export interface ProjectProgress {
  code: number;
  price: number;
}

/** Who chose a slot's target: the player, the system (automation), or nobody (fallback). */
export type SlotBy = 'player' | 'system' | 'fallback';

export interface SlotState {
  target: ProjectKey;
  by: SlotBy;
  /** Active time the target was set (tap rule, overrule timer). */
  sinceMs: number;
  /** A gig taken over a build: when it is paid, the slot goes back to that build. */
  resume?: { target: ProjectKey; by: SlotBy };
}

/** A gig on the board: its size and pay are drawn when it is offered. */
export interface GigOffer {
  /** Code it takes. */
  size: number;
  /** Money it pays when done. */
  pay: number;
  tier: 'normal' | 'tip' | 'ghost';
  /** The honest range shown on the card (common case). */
  payMin: number;
  payMax: number;
  clientId: string;
  paymentId: string;
}

export interface GigState {
  offer: GigOffer | null;
  /** No gig: SEARCH presses done of needed (null while a gig is offered or before any). */
  search: { done: number; needed: number } | null;
  paid: number;
  /** Active time accumulated toward the job-search bot's next step. */
  botMs: number;
}

export interface RentState {
  movedOut: boolean;
  /** Months since moving out (the rent creeps up by one step per month). */
  month: number;
  nextDueMs: number | null;
  missedStreak: number;
  missedTotal: number;
}

/** What the landlord wheel landed on: a slice or eviction. */
export type RentResult = RentOutcomeId | 'evicted';

export interface RentRecord {
  month: number;
  outcome: RentResult;
  /** Chance of eviction on this spin (shown as the red slice). */
  hazard: number;
  rent: number;
  catAlive: boolean;
  activeMs: number;
}

export interface JobState {
  offer: { salary: number; expiresAtMs: number } | null;
  employed: {
    salary: number;
    /** Employed time in the current month (pro-rated pay). */
    monthEmployedMs: number;
    /** Paydays survived in this job (the tryout bar). */
    paydays: number;
    permanent: boolean;
  } | null;
  /** Time another project has been the target while employed (fired after the grace). */
  awayMs: number;
  cooldownUntilMs: number | null;
  fired: number;
}

/** A pending full-panel notice besides technology discoveries (market updates, milestones). */
export type Notice = { kind: 'market'; era: number } | { kind: 'milestone'; id: MilestoneId };

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
  /** Coded demos, in making order (cosmetic). */
  demos: DemoRecord[];
  /** The player's design for the next demo (see `DemoRecord.pick`), until it is made. */
  demoPick: number | null;
  /** The corner plant: watered too often it drowns, too rarely it dries out. */
  plant: PlantState;
  /** Experience carried in from earlier runs' endings: +this much code yield (0.1 = +10 %). */
  experience: number;
  /** Rent factor carried in from earlier runs (0.9 after AI Got My Job). */
  frugal: number;
  /** Code built into projects so far (docs/feature_projects.md). */
  projects: Partial<Record<ProjectKey, ProjectProgress>>;
  /** Build slots: one, two from Worktrees. */
  slots: SlotState[];
  gigs: GigState;
  rent: RentState;
  /** Landlord wheel results in order; `rentWheelsSeen` of them were shown. */
  rentWheels: RentRecord[];
  rentWheelsSeen: number;
  job: JobState;
  /** Market updates and milestones waiting for their panel. */
  notices: Notice[];
  ending: EndingRecord | null;
}

export type ReadonlyRun = DeepReadonly<RunState>;

export type GameCommand =
  | { type: 'primaryAction' }
  | { type: 'buyUpgrade'; id: UpgradeId }
  | { type: 'selectProject'; id: ProjectKey }
  | { type: 'searchJob' }
  | { type: 'acknowledgeNotice' }
  | { type: 'acknowledgeRentWheel' }
  | { type: 'acknowledgeUnlock'; id: TechnologyId }
  | { type: 'shipRelease' }
  | { type: 'makeDemo' }
  | { type: 'designDemo'; pick: number | null }
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
  | { type: 'demoMade'; number: number }
  | { type: 'demoDesigned' }
  | { type: 'catCared'; kind: 'feed' | 'pet' | 'play' }
  | { type: 'purchased'; id: UpgradeId }
  | { type: 'projectBuilt'; id: ProjectKey }
  /** The release or a demo holds its price and waits for SHIP / RUN. */
  | { type: 'projectReady'; id: 'release' | 'demo' }
  | { type: 'gigPaid'; amount: number }
  | { type: 'hired' }
  | { type: 'fired'; reasonId: string; finalPay: number }
  | { type: 'rentMissed'; outcome: RentResult }
  | { type: 'technologyDiscovered'; id: TechnologyId };

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
