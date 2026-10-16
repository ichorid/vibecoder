import type {
  ChoiceId,
  EndingId,
  PrimaryActionId,
  ReleaseOutcomeId,
  ReleaseWindow,
  ResponsibilityId,
  TechnologyId,
  UpgradeId,
} from './ids';
import type { CareNote, CatHistoryId, ReadonlyRun } from './types';

/**
 * Content contract passed to the simulation by app composition. Values are authored in
 * content/; units are part of field names.
 */
/** Cat rules. Rates are per needs tick unless the name says per minute. */
export interface CatBalance {
  readonly needsTickMs: number;
  readonly fullnessDecayPerTick: number;
  readonly moodDecayPerTick: number;
  /** Extra decay fraction per meaningful action, capped per tick, reset after each tick. */
  readonly accelerationPerAction: number;
  readonly accelerationCap: number;
  readonly hungryBelow: number;
  readonly lonelyBelow: number;
  readonly attentionBelow: number;
  readonly overfedAt: number;
  readonly sickAt: number;
  readonly criticalBelow: number;
  readonly starvationBelow: number;
  readonly starvationHealthPerMinute: number;
  readonly severeStarvationAtOrBelow: number;
  readonly severeStarvationHealthPerMinute: number;
  readonly recoveryAbove: number;
  readonly recoveryHealthPerMinute: number;
  readonly overfeedingDecayPerMinute: number;
  readonly sicknessMoodPerMinute: number;
  readonly sicknessHealthPerMinute: number;
  readonly sicknessHealthFloor: number;
  readonly feedMin: number;
  readonly feedMax: number;
  readonly feedLockMs: number;
  readonly overfeedPressure: number;
  readonly overfeedFullnessAt: number;
  readonly overfeedOverflowAt: number;
  readonly petMood: number;
  readonly petCooldownMs: number;
  /** Asking for attention this long without a break (and not critically weak), the cat leaves. */
  readonly strayAfterIgnoredMs: number;
}

/** PLAY timing minigame. Positions are normalized track coordinates 0–1. */
export interface CatPlayBalance {
  readonly attempts: number;
  readonly readyMs: number;
  readonly movementMs: number;
  readonly resultMs: number;
  /** A catch during the result pause is ignored this soon after the catch (double taps). */
  readonly skipLockMs: number;
  readonly resumeCueMs: number;
  readonly targetWidthMin: number;
  readonly targetWidthMax: number;
  /** Normalized track lengths per second. */
  readonly speedMin: number;
  readonly speedMax: number;
  /** Narrowest crossing of the target must last at least this long (every attempt). */
  readonly minHitWindowMs: number;
  /** Each next attempt in a session: speed × this, band width × `attemptWidthFactor`. */
  readonly attemptSpeedFactor: number;
  readonly attemptWidthFactor: number;
  readonly nearMissDistance: number;
  readonly hitMoodMin: number;
  readonly hitMoodMax: number;
  readonly nearMissMood: number;
}

/** Foreground attention intrusions (active-time schedule). */
export interface AttentionBalance {
  readonly smallBelowMood: number;
  readonly largeBelowMood: number;
  /** Below this health the cat is too weak to ask for anything: no intrusions at all. */
  readonly quietBelowHealth: number;
  readonly smallIntervalMs: number;
  readonly smallDurationMs: number;
  readonly largeIntervalMs: number;
  readonly largeDurationMs: number;
}

/** Agent economy constants (architecture §5). */
export interface AgentBalance {
  /** Queued agent work, in agent-seconds, cannot exceed this. */
  readonly taskQueueCap: number;
  /** Token stock never exceeds this many seconds of current supply plus a base reserve. */
  readonly tokenReserve: number;
  readonly tokenReserveSupplySeconds: number;
}

/** Coordination and the DELEGATE/SUPERVISE contributions (each bounded). */
export interface CoordinationBalance {
  readonly baseManaged: number;
  readonly delegationCap: number;
  readonly delegationDecayPerSecond: number;
  readonly supervisePerPress: number;
}

export interface BalanceDefinition {
  readonly coordination: CoordinationBalance;
  /** Token cost never drops below this. */
  readonly minTokenCostPerWork: number;
  /** OPTIMIZE: temporary efficiency per press, cap, and decay per second. */
  readonly optimizeStep: number;
  readonly optimizeCap: number;
  readonly optimizeDecayPerSecond: number;
  /** Primary-action budget: presses beyond this rate do nothing (no autoclicker bypass). */
  readonly actionBurst: number;
  readonly actionRefillPerSecond: number;
  readonly agents: AgentBalance;
  readonly cat: CatBalance;
  readonly catPlay: CatPlayBalance;
  readonly attention: AttentionBalance;
  /** Output queued by one accepted WRITE CODE before technology bonuses. */
  readonly manualOutputPerAction: number;
  /** Recent ambient log lines kept in the run. */
  readonly logMemoryLimit: number;
  /** Recent log lines shown in Game. */
  readonly logVisibleLines: number;
  readonly tokens: TokenBalance;
  readonly chatter: ChatterBalance;
}

/** Console chatter pace: a line every min–max active ms; the newest few techs talk more. */
export interface ChatterBalance {
  readonly minGapMs: number;
  readonly maxGapMs: number;
  readonly newestCount: number;
  readonly newestWeight: number;
}

/** Buying tokens with code, auto-refill and token-spending reviews. */
export interface TokenBalance {
  /** Tokens one unit of code buys before reviews. */
  readonly perCodeBase: number;
  /** A pack covers this many seconds of current agent demand… */
  readonly packSeconds: number;
  /** …but never fewer tokens than this. */
  readonly packMin: number;
  /** Auto-refill buys a pack only once tokens fall below this (i.e. they ran out). */
  readonly refillBelowTokens: number;
  /** Share of current code auto-refill v1's bug deletes. */
  readonly disasterLoss: number;
  /** v1's first disaster lands on one of these refills (uniformly). */
  readonly firstDisasterFrom: number;
  readonly firstDisasterTo: number;
  /** After the first disaster, every v1 refill fails with this chance. */
  readonly laterDisasterChance: number;
  /** Rate bonus per "Review your token spending" level. */
  readonly reviewStep: number;
  readonly autoReviewEveryMs: number;
  readonly autoReviewStep: number;
  readonly autoReviewCap: number;
}

/** Small effect union; derived rates are recomputed from ownership, never stacked in state. */
export type Effect =
  | { readonly kind: 'manualOutput'; readonly amount: number }
  | { readonly kind: 'passiveOutputPerSecond'; readonly amount: number }
  | { readonly kind: 'agents'; readonly amount: number }
  | { readonly kind: 'compute'; readonly amount: number }
  | { readonly kind: 'workPerAgentPerSecond'; readonly amount: number }
  | { readonly kind: 'tokenSupplyPerSecond'; readonly amount: number }
  | { readonly kind: 'tokenCostPerWork'; readonly amount: number }
  | { readonly kind: 'tasksPerPrompt'; readonly amount: number }
  | { readonly kind: 'passiveTasksPerSecond'; readonly amount: number }
  /** Multiplies how much work one queued agent-second covers. */
  | { readonly kind: 'taskEfficiencyMultiplier'; readonly amount: number }
  | { readonly kind: 'debtPerUncheckedWork'; readonly amount: number }
  /** Multiplies the fraction of funded work that is unchecked (base 1). */
  | { readonly kind: 'uncheckedFractionMultiplier'; readonly amount: number }
  | { readonly kind: 'reviewPerSecond'; readonly amount: number }
  /** Agents that can be coordinated without losses. */
  | { readonly kind: 'managedCapacity'; readonly amount: number }
  /** Multiplies token cost per work (bounded below by balance.minTokenCostPerWork). */
  | { readonly kind: 'tokenCostMultiplier'; readonly amount: number }
  /** Adds to the useful-output efficiency multiplier (base 1). */
  | { readonly kind: 'efficiency'; readonly amount: number }
  | { readonly kind: 'automates'; readonly responsibility: ResponsibilityId }
  /** Revenue earned per unit of useful output. */
  | { readonly kind: 'monetization'; readonly amount: number }
  | { readonly kind: 'monetizationMultiplier'; readonly amount: number }
  /** Revenue spent per second per active agent once operating costs exist. */
  | { readonly kind: 'operatingCostPerAgent'; readonly amount: number }
  /** One-time stock granted in the discovery transaction (not a rate). */
  | { readonly kind: 'grantTokens'; readonly amount: number }
  /** More tokens per code spent on token packs (fraction per level, additive). */
  | { readonly kind: 'tokensPerCodeBonus'; readonly amount: number }
  /** Buys token packs automatically when tokens run low; version 1 has a bug. */
  | { readonly kind: 'autoRefill'; readonly version: 1 | 2 }
  /** Periodically improves the tokens-per-code rate (balance.tokens.autoReview*). */
  | { readonly kind: 'autoReview' };

/** Runtime list of effect kinds for content validation; must match `Effect['kind']`. */
export const EFFECT_KINDS = [
  'manualOutput',
  'passiveOutputPerSecond',
  'agents',
  'compute',
  'workPerAgentPerSecond',
  'tokenSupplyPerSecond',
  'tokenCostPerWork',
  'tasksPerPrompt',
  'passiveTasksPerSecond',
  'taskEfficiencyMultiplier',
  'debtPerUncheckedWork',
  'uncheckedFractionMultiplier',
  'reviewPerSecond',
  'managedCapacity',
  'tokenCostMultiplier',
  'efficiency',
  'automates',
  'monetization',
  'monetizationMultiplier',
  'operatingCostPerAgent',
  'grantTokens',
  'tokensPerCodeBonus',
  'autoRefill',
  'autoReview',
] as const;
type EffectKindsMatch = [Effect['kind']] extends [(typeof EFFECT_KINDS)[number]]
  ? [(typeof EFFECT_KINDS)[number]] extends [Effect['kind']]
    ? true
    : never
  : never;
export const effectKindsMatch: EffectKindsMatch = true;

export type Currency = 'output' | 'revenue';

export interface Requirements {
  readonly technologies?: readonly TechnologyId[];
  readonly lifetimeOutput?: number;
}

/** Header statistics a technology may select (at most three are shown). */
export const STAT_IDS = ['output', 'tokens', 'debt', 'automation', 'revenue', 'margin'] as const;
export type StatId = (typeof STAT_IDS)[number];

/** Conditions that make an optional upgrade a recovery card (shown before repeatables). */
export interface RecoveryRule {
  readonly tokensBelow?: number;
}

export interface UpgradeDefinition {
  readonly id: UpgradeId;
  readonly title: string;
  readonly description: string;
  readonly currency: Currency;
  readonly basePrice: number;
  /** Price multiplier per owned level; 1 for one-time upgrades. */
  readonly priceGrowth: number;
  readonly maxLevel: number;
  /** When the offer may be shown. Visibility does not imply affordability. */
  readonly requires: Requirements;
  /** Lower values are shown first; progression/recovery cards precede optional repeatables. */
  readonly priority: number;
  /** Progression upgrade: buying it allows this technology to be discovered. */
  readonly discovers?: TechnologyId;
  /** Effects granted per owned level (repeatables). One-time transitions keep effects on the technology. */
  readonly effectsPerLevel: readonly Effect[];
  /** Optional named rule for conditions the declarative requirements cannot express. */
  readonly extraCondition?: (run: ReadonlyRun) => boolean;
  /** When this holds, the card is a recovery choice and outranks optional repeatables. */
  readonly recovery?: RecoveryRule;
  /**
   * A consumable purchase instead of a level: `tokens` buys a token pack whose size and price
   * follow current demand and the tokens-per-code rate (basePrice/priceGrowth are unused).
   */
  readonly pack?: 'tokens';
}

export interface TechnologyDefinition {
  readonly id: TechnologyId;
  readonly prerequisites: readonly TechnologyId[];
  readonly title: string;
  readonly description: string;
  readonly illustrationId: string;
  readonly worldAdditionId: string;
  readonly primaryAction?: PrimaryActionId;
  readonly effects: readonly Effect[];
  /** Header statistics from this point on (latest technology that sets them wins). */
  readonly headerStats?: readonly StatId[];
}

export type CatPresentation =
  'dead' | 'critical' | 'sick' | 'hungry' | 'attentionSeeking' | 'lonely' | 'normal';

/** Cat view copy. Care notes come from the last accepted care action. */
export interface CatText {
  readonly conditions: Readonly<Record<CatPresentation, string>>;
  readonly overfed: string;
  readonly care: Readonly<Record<CareNote, string>>;
  readonly history: Readonly<Record<CatHistoryId, string>>;
  /** How long a care message stays relevant, in active ms. */
  readonly careMessageMs: number;
}

/** A short dynamically triggered message (architecture §9). Predicates read the run only. */
export interface EventDefinition {
  readonly id: string;
  /** Shown before the line in the terminal log. */
  readonly emoji: string;
  readonly text: string;
  readonly when: (run: ReadonlyRun) => boolean;
  /** Fires at most once per run. */
  readonly once?: boolean;
  /** Minimum active time between two firings of a repeating event. */
  readonly cooldownMs?: number;
  /** Significant events are kept in History as well as the log. */
  readonly significant?: boolean;
}

/** A discovered-only record: never shown before it happens, never a productivity bonus. */
export interface AchievementDefinition {
  readonly id: string;
  readonly title: string;
  readonly when: (run: ReadonlyRun) => boolean;
}

/** A decision card. `ends` makes it an ending choice; otherwise it commits a path. */
export interface ChoiceDefinition {
  readonly id: ChoiceId;
  readonly title: string;
  /** Static text, or one that reads the run (e.g. how many releases shipped). */
  readonly description: string | ((run: ReadonlyRun) => string);
  /** Destructive commitments ask for an inline confirmation with this text. */
  readonly confirm?: string;
  readonly available: (run: ReadonlyRun) => boolean;
  readonly ends?: EndingId;
  /** Fixed extra operating cost per second this commitment adds (loss-making expansion). */
  readonly overhead?: (run: ReadonlyRun) => number;
}

export interface EndingDefinition {
  readonly id: EndingId;
  readonly title: string;
  /** Paragraphs by the cat's fate when the run ended. */
  readonly text: {
    readonly alive: readonly string[];
    readonly dead: readonly string[];
    /** The cat left as a stray during the run. */
    readonly stray: readonly string[];
  };
  /** Optional automatic resolution; simultaneous candidates resolve by highest priority. */
  readonly automatic?: { readonly priority: number; readonly when: (run: ReadonlyRun) => boolean };
  /** Reached by a release jackpot rather than a choice or a rule. */
  readonly jackpot?: boolean;
  /** No longer reachable; kept so old profiles and saves still show it. */
  readonly legacy?: boolean;
  /** Ending picture, exported with the cat (`<id>`) and without it (`<id>-nocat`). */
  readonly illustrationId?: string;
}

/** Text that differs when there is no cat (dead or gone): no cat in any text or picture. */
export type CatAwareText = string | { readonly alive: string; readonly absent: string };

/** A launch window: opens when its technology is unlocked; one release per window. */
export interface ReleaseWindowDefinition {
  readonly window: ReleaseWindow;
  readonly version: string;
  readonly technology: TechnologyId;
  /** Paid from the spendable code balance. */
  readonly price: number;
  /** Percent of a whole run won at this window by a player who ships every time. */
  readonly jackpotWeight: number;
  readonly title: string;
  /** Card description; also the log line when the window opens. */
  readonly description: string;
}

export interface ReleaseSliceDefinition {
  readonly id: ReleaseOutcomeId;
  /** Short wheel label (≤ 10 characters). */
  readonly label: CatAwareText;
  /** The result card body. */
  readonly text: CatAwareText;
}

export interface ReleaseComment {
  readonly id: string;
  readonly text: string;
}

export interface ReleaseContent {
  readonly windows: readonly ReleaseWindowDefinition[];
  readonly slices: readonly ReleaseSliceDefinition[];
  /** Third-party top comments (attributed in their own file). */
  readonly comments: readonly ReleaseComment[];
  /** A window closes once both this many more technologies and this much time passed. */
  readonly closeAfterTechnologies: number;
  readonly closeAfterMs: number;
  readonly jackpotEnding: EndingId;
  readonly jackpotLabel: string;
  /** `{version}` is replaced. */
  readonly closedText: string;
  /** `{version}` and `{label}` are replaced. */
  readonly shippedText: string;
}

export interface Catalog {
  /** Random console lines per technology (said once it is unlocked). */
  readonly chatter: Readonly<Partial<Record<TechnologyId, readonly string[]>>>;
  readonly choices: readonly ChoiceDefinition[];
  readonly releases: ReleaseContent;
  readonly endings: readonly EndingDefinition[];
  readonly events: readonly EventDefinition[];
  readonly achievements: readonly AchievementDefinition[];
  readonly catText: CatText;
  readonly balance: BalanceDefinition;
  readonly primaryActionLabels: Readonly<Record<PrimaryActionId, string>>;
  readonly statLabels: Readonly<Record<StatId, string>>;
  readonly technologies: readonly TechnologyDefinition[];
  readonly upgrades: readonly UpgradeDefinition[];
}
