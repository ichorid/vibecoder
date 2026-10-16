import type { Catalog, Requirements, TechnologyDefinition, UpgradeDefinition } from './catalog';
import { upgradeLevel } from './economy';
import type { PrimaryActionId } from './ids';
import { appendLog } from './log';
import type { Transition } from './simulation';
import type { GameFact, ReadonlyRun, RunState } from './types';

function meets(run: ReadonlyRun, requires: Requirements): boolean {
  if (requires.technologies?.some((id) => !run.unlockedTechnologyIds.includes(id))) return false;
  if (requires.lifetimeOutput !== undefined && run.stats.lifetimeOutput < requires.lifetimeOutput) {
    return false;
  }
  return true;
}

/**
 * An offer is visible when its requirements hold and it is not exhausted. A progression offer
 * additionally waits until every earlier discovery has been acknowledged.
 */
export function isUpgradeOffered(run: ReadonlyRun, upgrade: UpgradeDefinition): boolean {
  if (upgradeLevel(run, upgrade.id) >= upgrade.maxLevel) return false;
  if (upgrade.discovers !== undefined && run.pendingUnlockIds.length > 0) return false;
  if (!meets(run, upgrade.requires)) return false;
  return upgrade.extraCondition ? upgrade.extraCondition(run) : true;
}

export function findUpgrade(catalog: Catalog, id: string): UpgradeDefinition | undefined {
  return catalog.upgrades.find((upgrade) => upgrade.id === id);
}

export function findTechnology(catalog: Catalog, id: string): TechnologyDefinition | undefined {
  return catalog.technologies.find((technology) => technology.id === id);
}

function canDiscover(
  run: ReadonlyRun,
  technology: TechnologyDefinition,
  catalog: Catalog,
): boolean {
  if (run.unlockedTechnologyIds.includes(technology.id)) return false;
  if (technology.prerequisites.some((id) => !run.unlockedTechnologyIds.includes(id))) return false;
  return catalog.upgrades.some(
    (upgrade) => upgrade.discovers === technology.id && upgradeLevel(run, upgrade.id) > 0,
  );
}

/**
 * Commit each newly discoverable technology once: unlocked ID (its effects now apply), one
 * History entry, and one pending announcement, in the same transaction. Idempotent.
 */
export function resolveDiscoveries(run: RunState, catalog: Catalog): Transition {
  let next = run;
  const facts: GameFact[] = [];
  for (const technology of catalog.technologies) {
    if (!canDiscover(next, technology, catalog)) continue;
    next = {
      ...next,
      unlockedTechnologyIds: [...next.unlockedTechnologyIds, technology.id],
      pendingUnlockIds: [...next.pendingUnlockIds, technology.id],
      history: [
        ...next.history,
        { kind: 'technology', id: technology.id, activeMs: next.activeMs },
      ],
    };
    next = appendLog(next, `${technology.title} unlocked.`, catalog);
    facts.push({ type: 'technologyDiscovered', id: technology.id });
  }
  return { run: next, facts };
}

/** The latest discovered technology that defines a primary action decides the current one. */
export function currentPrimaryAction(run: ReadonlyRun, catalog: Catalog): PrimaryActionId {
  let action: PrimaryActionId = 'writeCode';
  for (const id of run.unlockedTechnologyIds) {
    const definition = findTechnology(catalog, id);
    if (definition?.primaryAction) action = definition.primaryAction;
  }
  return action;
}
