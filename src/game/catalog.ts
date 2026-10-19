import type {
  ChoiceId,
  EndingId,
  PrimaryActionId,
  ReleaseOutcomeId,
  ReleaseWindow,
  RentOutcomeId,
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
  readonly agents: AgentBalance;
  readonly cat: CatBalance;
  readonly catPlay: CatPlayBalance;
  readonly attention: AttentionBalance;
  /** Output queued by one accepted WRITE CODE before technology bonuses. */
  readonly manualOutputPerAction: number;
  /** Recent log lines kept in the run (all of them scroll in Game's terminal). */
  readonly logMemoryLimit: number;
  readonly tokens: TokenBalance;
  readonly chatter: ChatterBalance;
  readonly money: MoneyBalance;
  readonly plant: PlantBalance;
  readonly projects: ProjectBalance;
  readonly gigs: GigBalance;
  readonly rent: RentBalance;
  readonly job: JobBalance;
}

/** Projects and build slots (docs/feature_projects.md). */
export interface ProjectBalance {
  /** A slot nobody chose (after a build, before Manager Agent) builds at this rate. */
  readonly fallbackFactor: number;
  /** Seconds of the smoothed code rate (`economy.codeRate` reacts within a few seconds). */
  readonly codeRateSeconds: number;
  /** Automation moves a slot off a ready release/demo after this long. */
  readonly readyLeaveMs: number;
  /** Workflow Optimization overrules a weak player pick after this long… */
  readonly overruleMs: number;
  /** …when it pays back less than this share of the system's pick. */
  readonly overruleRatio: number;
  /** Self-Improvement starts one of its own projects this often… */
  readonly internalEveryMs: number;
  /** …sized at this many seconds of code. */
  readonly internalSeconds: number;
  /** Auto-selection logs at most one line per this long. */
  readonly autoLogEveryMs: number;
}

/** Gigs (docs/feature_money.md §5.2–5.4). */
export interface GigBalance {
  /** Starting savings, paid in when money first appears. */
  readonly savings: number;
  /** A gig is this many seconds of the current code rate… */
  readonly seconds: number;
  /** …but never smaller than this. */
  readonly minSize: number;
  readonly payMin: number;
  readonly payMax: number;
  readonly tipChance: number;
  readonly tipFactor: number;
  readonly ghostChance: number;
  readonly ghostFactor: number;
  /** After a paid gig, the next one waits with this chance; otherwise a search is needed. */
  readonly nextChance: number;
  readonly searchMin: number;
  readonly searchMax: number;
  /** The job-search bot (and auto-freelancing) searches once per this long. */
  readonly botEveryMs: number;
  /** Auto-freelancing takes a gig below this many rents… */
  readonly lowMoneyRents: number;
  /** …or this many seconds of token spending, whichever is more. */
  readonly lowMoneyTokenSeconds: number;
  /** Token packs cost their code value in money times this (the reseller rounds up). */
  readonly tokenMarkup: number;
}

/** Rent, upkeep and the landlord (docs/feature_money.md §5.5–5.6). */
export interface RentBalance {
  readonly base: number;
  /** Added every month, quietly. */
  readonly creep: number;
  readonly monthMs: number;
  readonly foodPerFeed: number;
}

/** The enterprise job (docs/feature_money.md §5.8). */
export interface JobBalance {
  readonly offerChance: number;
  /** No offers before this many months after moving out. */
  readonly offerFromMonth: number;
  readonly offerExpiresMs: number;
  /** Salary: this share of what a month of the current code would earn freelancing. */
  readonly salaryShare: number;
  /** Another target for longer than this gets you fired. */
  readonly fireGraceMs: number;
  /** The hidden chance of a layoff at every payday. */
  readonly layoffChance: number;
  readonly cooldownMonths: number;
  /** Paydays of tryout before the permanent contract. */
  readonly tryoutMonths: number;
}

/** The corner plant: water drains over active time; each watering adds some. */
export interface PlantBalance {
  readonly start: number;
  readonly drainPerMinute: number;
  readonly perWatering: number;
  /** More water than this and it drowns. */
  readonly drownAbove: number;
  readonly thirstyBelow: number;
  readonly soggyAbove: number;
}

/** When costs exceed revenue the bank lends: down to this many seconds of costs, with interest. */
export interface MoneyBalance {
  readonly creditSeconds: number;
  /** Interest per second on the money owed (fraction). */
  readonly interestPerSecond: number;
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
  /** …but never less than this many seconds of current output (clamped to the bank). */
  readonly disasterSeconds: number;
  /** v1's first disaster lands on one of these refills (uniformly). */
  readonly firstDisasterFrom: number;
  readonly firstDisasterTo: number;
  /** After the first disaster, every v1 refill fails with this chance. */
  readonly laterDisasterChance: number;
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
  'autoRefill',
  'autoReview',
] as const;
type EffectKindsMatch = [Effect['kind']] extends [(typeof EFFECT_KINDS)[number]]
  ? [(typeof EFFECT_KINDS)[number]] extends [Effect['kind']]
    ? true
    : never
  : never;
export const effectKindsMatch: EffectKindsMatch = true;

/** Code is built into projects; money buys things (tokens, compute, the company's cards). */
export type Currency = 'output' | 'money';

export interface Requirements {
  readonly technologies?: readonly TechnologyId[];
  readonly lifetimeOutput?: number;
}

/** Header statistics a technology may select (four fit one row; five or six take two). */
export const STAT_IDS = [
  'code',
  'tokens',
  'debt',
  'automation',
  'money',
  'margin',
  'quality',
  'team',
] as const;
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
  /** Price multiplier per owned level; 1 for one-time upgrades (the floor with `priceRule`). */
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
  /**
   * Capacity priced by payback: about `paybackSeconds` of one runnable agent's useful work right
   * now, never below the level price (a gentle `priceGrowth`, so idle capacity is no free spam).
   */
  readonly priceRule?: { readonly paybackSeconds: number };
  /** Optional named rule for conditions the declarative requirements cannot express. */
  readonly extraCondition?: (run: ReadonlyRun) => boolean;
  /** When this holds, the card is a recovery choice and outranks optional repeatables. */
  readonly recovery?: RecoveryRule;
  /**
   * A consumable purchase instead of a level: `tokens` buys a token pack whose size and price
   * follow current demand and the tokens-per-code rate (basePrice/priceGrowth are unused).
   */
  readonly pack?: 'tokens';
  /** Paid in money at the market rate: worth its code price × `marketRate` (tokens, compute). */
  readonly marketPriced?: boolean;
  /**
   * The system's own project (Self-Improvement): never offered as a card; priced at
   * `balance.projects.internalSeconds` of code when it starts.
   */
  readonly internal?: boolean;
  /** Logged when it is built (instead of "Built …"). */
  readonly builtText?: string;
  /** Card lines for what no `Effect` describes (e.g. the job-search bot). */
  readonly effectLines?: readonly string[];
}

export interface TechnologyDefinition {
  readonly id: TechnologyId;
  readonly prerequisites: readonly TechnologyId[];
  readonly title: string;
  /** Shown in the discovery; a cat-aware text has a version for when the cat is gone. */
  readonly description: CatAwareText;
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
  /** A cat-aware text has a version for when the cat is gone (dead or a stray). */
  readonly text: CatAwareText;
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
  /** Choosing this one undoes another choice's fixed overhead (pulling out of an expansion). */
  readonly cancels?: ChoiceId;
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
  /** A lesson learned: reaching it adds this much code yield to every later run (stacks). */
  readonly experience?: number;
  /** A lesson of another kind: rent in every later run is multiplied by this (live frugal). */
  readonly frugal?: number;
  /** No longer reachable; kept so old profiles and saves still show it. */
  readonly legacy?: boolean;
  /** Ending picture, exported with the cat (`<id>`) and without it (`<id>-nocat`). */
  readonly illustrationId?: string;
}

/** Text that differs when there is no cat (dead or gone): no cat in any text or picture. */
export type CatAwareText = string | { readonly alive: string; readonly absent: string };

/**
 * One release, in order. The next one is always on offer: it needs at least `price` code, and
 * shipping it spends all of the player's code.
 */
export interface ReleaseWindowDefinition {
  readonly window: ReleaseWindow;
  readonly version: string;
  /** The least code needed; shipping spends all of it. */
  readonly price: number;
  /** Percent of a whole run won at this release by a player who ships every one. */
  readonly jackpotWeight: number;
  readonly title: string;
  /** Card description; also the log line when it becomes available. */
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
  /** The authored releases (v0.1 … v3.0); later ones are generated from the last. */
  readonly windows: readonly ReleaseWindowDefinition[];
  /** Releases are on offer once this technology exists (the project works). */
  readonly availableFrom: TechnologyId;
  /** Each release after the authored ones needs this many times more code. */
  readonly laterPriceGrowth: number;
  readonly laterDescription: string;
  readonly slices: readonly ReleaseSliceDefinition[];
  /** Third-party top comments (attributed in their own file). */
  readonly comments: readonly ReleaseComment[];
  readonly jackpotEnding: EndingId;
  readonly jackpotLabel: string;
  /** `{version}` and `{label}` are replaced. */
  readonly shippedText: string;
}

/** Code a demo (docs/feature_demo.md): a cosmetic code sink with generated titles. */
export interface DemoContent {
  /** Demos are possible once this technology exists. */
  readonly availableFrom: TechnologyId;
  readonly basePrice: number;
  /** Each next demo costs this many times the last. */
  readonly priceGrowth: number;
  /** The strip's label. */
  readonly title: string;
  /** Logged once when demos become possible. */
  readonly notice: string;
  /** Logged per demo; `{n}`, `{title}`, `{group}` are replaced. */
  readonly madeText: string;
  readonly groups: readonly string[];
  /** A title is one of each, e.g. "Infinite" + "Context". */
  readonly titleFirst: readonly string[];
  readonly titleSecond: readonly string[];
  /** Who the scroller greets (three to five of them per demo). */
  readonly greetings: readonly CatAwareText[];
  /** Scroller lines (three per demo). */
  readonly scroller: readonly CatAwareText[];
}

/** One era of the gig market: from this technology on, gigs pay `rate` money per line. */
export interface MarketEra {
  readonly from: TechnologyId | null;
  readonly rate: number;
  /** The market update panel (none for the first era). */
  readonly title: string;
  readonly text: string;
}

export interface FlavourLine {
  readonly id: string;
  readonly text: CatAwareText;
}

export interface RentSliceDefinition {
  readonly id: RentOutcomeId;
  readonly label: CatAwareText;
  readonly text: CatAwareText;
  /** Money effect as a share of this month's rent (negative: a fee; positive: money in). */
  readonly rentShare: number;
}

export interface FiringReason {
  readonly id: string;
  readonly text: string;
  /** Only while the cat is there. */
  readonly needsCat?: boolean;
  /** Only after the permanent contract. */
  readonly afterContract?: boolean;
}

/** Money: gigs, the market, rent, the landlord wheel and the enterprise job (texts). */
export interface MoneyContent {
  readonly eras: readonly MarketEra[];
  /** "Landing page for a dentist" */
  readonly clients: readonly FlavourLine[];
  /** "Paid in exposure, then in cash." */
  readonly payments: readonly FlavourLine[];
  readonly rentSlices: readonly RentSliceDefinition[];
  /** Eviction chance by consecutive missed month (the last one repeats). */
  readonly evictionHazards: readonly number[];
  readonly evictedLabel: string;
  readonly evictionEnding: EndingId;
  readonly firingReasons: readonly FiringReason[];
  /** Short log pools; `{…}` placeholders are filled by the game. */
  readonly lines: {
    readonly firstGig: string;
    readonly gigPaid: string;
    readonly gigTip: string;
    readonly gigGhost: string;
    readonly noGigs: string;
    readonly movedOut: string;
    /** Moved out without ever finishing a gig (the first market update). */
    readonly evictedByParents: string;
    readonly rentPaid: string;
    readonly rentMissed: string;
    readonly companyPaysRent: string;
    readonly gigsEnd: string;
    readonly bot: readonly string[];
    readonly freelance: readonly string[];
    readonly jobOffer: string;
    readonly jobExpired: string;
    readonly hired: string;
    readonly abandonGig: string;
    readonly fired: string;
    readonly cooldown: string;
    readonly payday: string;
    readonly contract: string;
    readonly fallback: readonly string[];
    readonly polish: readonly string[];
    readonly autoPick: string;
    readonly overruled: string;
    readonly deprioritised: string;
    readonly built: string;
    readonly feedCost: string;
  };
  readonly contract: {
    readonly title: string;
    readonly text: string;
    readonly illustrationId: string;
  };
}

export interface Catalog {
  readonly money: MoneyContent;
  readonly demos: DemoContent;
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
