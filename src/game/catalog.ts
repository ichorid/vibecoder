import type { PrimaryActionId, TechnologyId, UpgradeId } from './ids';
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
}

/** PLAY timing minigame. Positions are normalized track coordinates 0–1. */
export interface CatPlayBalance {
  readonly attempts: number;
  readonly readyMs: number;
  readonly movementMs: number;
  readonly resultMs: number;
  readonly resumeCueMs: number;
  readonly targetWidthMin: number;
  readonly targetWidthMax: number;
  /** Normalized track lengths per second. */
  readonly speedMin: number;
  readonly speedMax: number;
  /** Narrowest crossing of the target must last at least this long. */
  readonly minHitWindowMs: number;
  readonly nearMissDistance: number;
  readonly hitMoodMin: number;
  readonly hitMoodMax: number;
  readonly nearMissMood: number;
}

/** Foreground attention intrusions (active-time schedule). */
export interface AttentionBalance {
  readonly smallBelowMood: number;
  readonly largeBelowMood: number;
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
  /** One-time stock granted in the discovery transaction (not a rate). */
  | { readonly kind: 'grantTokens'; readonly amount: number };

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
  'grantTokens',
] as const;
type EffectKindsMatch = [Effect['kind']] extends [(typeof EFFECT_KINDS)[number]]
  ? [(typeof EFFECT_KINDS)[number]] extends [Effect['kind']]
    ? true
    : never
  : never;
export const effectKindsMatch: EffectKindsMatch = true;

export type Currency = 'output';

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
  readonly text: string;
  readonly when: (run: ReadonlyRun) => boolean;
  /** Fires at most once per run. */
  readonly once?: boolean;
  /** Minimum active time between two firings of a repeating event. */
  readonly cooldownMs?: number;
  /** Significant events are kept in History as well as the log. */
  readonly significant?: boolean;
}

export interface Catalog {
  readonly events: readonly EventDefinition[];
  readonly catText: CatText;
  readonly balance: BalanceDefinition;
  readonly primaryActionLabels: Readonly<Record<PrimaryActionId, string>>;
  readonly statLabels: Readonly<Record<StatId, string>>;
  readonly technologies: readonly TechnologyDefinition[];
  readonly upgrades: readonly UpgradeDefinition[];
}
