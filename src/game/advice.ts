/**
 * Which capacity card relieves what binds right now. Shared by the card surface (selectors) and
 * by auto-selection (projects): the same advice the player sees is what the manager follows.
 */
import type { Catalog, UpgradeDefinition } from './catalog';
import { codePrice, deriveRates, economyFlows, tokenDemandPerSecond } from './economy';
import { isUpgradeOffered } from './progression';
import { upgradeImpact } from './setup';
import type { ReadonlyRun } from './types';

export const CAPACITY_CARDS = ['additional-agent', 'compute-slot', 'review-capacity'] as const;
/** A capacity card "helps" when its extra code pays its price back within this long. */
export const HELPS_WITHIN_SECONDS = 300;

export interface CardAdvice {
  /** The optional card that relieves what binds now (shown first among optional cards). */
  readonly relevant: string | null;
  /** Capacity cards whose extra code would pay back soon (the others are not offered). */
  readonly helping: ReadonlySet<string>;
}

export type ImpactOf = (upgrade: UpgradeDefinition) => ReturnType<typeof upgradeImpact>;

/** Which optional card is relevant now, from the economy's own flows (one step ahead). */
export function cardAdvice(
  run: ReadonlyRun,
  catalog: Catalog,
  impactOf: ImpactOf = (upgrade) => upgradeImpact(run, upgrade, catalog),
): CardAdvice {
  const rates = deriveRates(run, catalog);
  const helping = new Set<string>();
  if (rates.agents === 0) return { relevant: null, helping };
  const offered = catalog.upgrades.filter(
    (u) => (CAPACITY_CARDS as readonly string[]).includes(u.id) && isUpgradeOffered(run, u),
  );
  // The capacity card that adds the most code per code spent (or its worth in money) right now…
  let best: { id: string; value: number } | null = null;
  for (const upgrade of offered) {
    const gain = impactOf(upgrade)?.codePerSecond ?? 0;
    const value = gain / Math.max(1, codePrice(run, upgrade, catalog));
    if (value * HELPS_WITHIN_SECONDS < 1) continue;
    helping.add(upgrade.id);
    if (!best || value > best.value) best = { id: upgrade.id, value };
  }
  return { relevant: relevantCard(run, catalog, rates, offered, best?.id ?? null), helping };
}

function relevantCard(
  run: ReadonlyRun,
  catalog: Catalog,
  rates: ReturnType<typeof deriveRates>,
  offered: readonly UpgradeDefinition[],
  best: string | null,
): string | null {
  const demand = tokenDemandPerSecond(rates);
  if (demand > 0 && run.economy.tokens < demand * 30) return 'token-supply';
  if (run.economy.debt > 20 && offered.some((u) => u.id === 'review-capacity')) {
    return 'review-capacity';
  }
  if (best) return best;
  // …or, when none helps alone (agents need compute and a manager), the scarcest of the three —
  // only while more agents can be hired (compute and managers beyond the agents do nothing).
  const flows = economyFlows(run.economy, rates, 0.1, catalog.balance);
  if (flows.funded < flows.demand - 1e-9) return null;
  if (!offered.some((u) => u.id === 'additional-agent')) return null;
  if (rates.agents <= Math.min(rates.compute, rates.managed)) return 'additional-agent';
  if (rates.compute <= rates.managed) return 'compute-slot';
  return 'review-capacity';
}
