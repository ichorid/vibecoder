import type { PrimaryActionId, TechnologyId, UpgradeId } from './ids';
import type { ReadonlyRun } from './types';

/**
 * Content contract passed to the simulation by app composition. Values are authored in
 * content/; units are part of field names.
 */
export interface BalanceDefinition {
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

export interface Catalog {
  readonly balance: BalanceDefinition;
  readonly primaryActionLabels: Readonly<Record<PrimaryActionId, string>>;
  readonly technologies: readonly TechnologyDefinition[];
  readonly upgrades: readonly UpgradeDefinition[];
}
