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

export interface BalanceDefinition {
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
  | { readonly kind: 'passiveOutputPerSecond'; readonly amount: number };

/** Runtime list of effect kinds for content validation; must match `Effect['kind']`. */
export const EFFECT_KINDS = ['manualOutput', 'passiveOutputPerSecond'] as const;
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

export interface Catalog {
  readonly catText: CatText;
  readonly balance: BalanceDefinition;
  readonly primaryActionLabels: Readonly<Record<PrimaryActionId, string>>;
  readonly technologies: readonly TechnologyDefinition[];
  readonly upgrades: readonly UpgradeDefinition[];
}
