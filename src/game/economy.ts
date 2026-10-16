import type { Catalog, Effect, UpgradeDefinition } from './catalog';
import type { ReadonlyRun } from './types';

/** Keep repeated 100 ms fractional increments from drifting below exact prices. */
export function roundAmount(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function upgradeLevel(run: ReadonlyRun, id: UpgradeDefinition['id']): number {
  return run.upgradeLevels[id] ?? 0;
}

export function upgradePrice(definition: UpgradeDefinition, level: number): number {
  return roundAmount(definition.basePrice * definition.priceGrowth ** level);
}

export interface DerivedRates {
  /** Output queued by one accepted manual action. */
  readonly manualOutput: number;
  readonly passiveOutputPerSecond: number;
}

/** Every effect that currently applies: owned technologies plus per-level upgrade effects. */
export function activeEffects(run: ReadonlyRun, catalog: Catalog): Effect[] {
  const effects: Effect[] = [];
  for (const technology of catalog.technologies) {
    if (run.unlockedTechnologyIds.includes(technology.id)) effects.push(...technology.effects);
  }
  for (const upgrade of catalog.upgrades) {
    const level = upgradeLevel(run, upgrade.id);
    for (let i = 0; i < level; i += 1) effects.push(...upgrade.effectsPerLevel);
  }
  return effects;
}

/** Rates are recomputed from definitions on demand, never stored as stacked multipliers. */
export function deriveRates(run: ReadonlyRun, catalog: Catalog): DerivedRates {
  let manualOutput = catalog.balance.manualOutputPerAction;
  let passiveOutputPerSecond = 0;
  for (const effect of activeEffects(run, catalog)) {
    switch (effect.kind) {
      case 'manualOutput':
        manualOutput += effect.amount;
        break;
      case 'passiveOutputPerSecond':
        passiveOutputPerSecond += effect.amount;
        break;
    }
  }
  return { manualOutput, passiveOutputPerSecond };
}
