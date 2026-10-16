/**
 * Structural catalog/asset consistency checks. This catches broken definitions; it does not
 * prove that a route is reachable or balanced — scenarios do that.
 */
import type { AssetManifest } from '../src/content/assets';
import type { WorldAddition } from '../src/content/world';
import { EFFECT_KINDS, type Catalog, type Effect } from '../src/game/catalog';

export interface ContentBundle {
  readonly catalog: Catalog;
  readonly assets: AssetManifest;
  readonly worldAdditions: readonly WorldAddition[];
}

export interface ContentIssue {
  readonly message: string;
}

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }
  return [...repeated];
}

function checkEffects(owner: string, effects: readonly Effect[], issues: ContentIssue[]): void {
  for (const effect of effects) {
    if (!(EFFECT_KINDS as readonly string[]).includes(effect.kind)) {
      issues.push({ message: `${owner}: unknown effect kind "${String(effect.kind)}"` });
    } else if ('amount' in effect && !Number.isFinite(effect.amount)) {
      issues.push({ message: `${owner}: effect "${effect.kind}" has a nonfinite amount` });
    }
  }
}

function findCycle(catalog: Catalog): string[] | null {
  const byId = new Map(catalog.technologies.map((t) => [t.id as string, t]));
  const state = new Map<string, 'visiting' | 'done'>();
  const path: string[] = [];
  const visit = (id: string): string[] | null => {
    if (state.get(id) === 'done') return null;
    if (state.get(id) === 'visiting') return [...path.slice(path.indexOf(id)), id];
    state.set(id, 'visiting');
    path.push(id);
    for (const prerequisite of byId.get(id)?.prerequisites ?? []) {
      const cycle = visit(prerequisite);
      if (cycle) return cycle;
    }
    path.pop();
    state.set(id, 'done');
    return null;
  };
  for (const id of byId.keys()) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return null;
}

export function validateContent({
  catalog,
  assets,
  worldAdditions,
}: ContentBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const technologyIds = new Set<string>(catalog.technologies.map((t) => t.id));
  const illustrationIds = new Set(assets.illustrations.map((a) => a.id));
  const worldIds = new Set(worldAdditions.map((w) => w.id));

  for (const id of duplicates(catalog.technologies.map((t) => t.id))) {
    issues.push({ message: `duplicate technology id "${id}"` });
  }
  for (const id of duplicates(catalog.upgrades.map((u) => u.id))) {
    issues.push({ message: `duplicate upgrade id "${id}"` });
  }
  for (const id of duplicates(assets.illustrations.map((a) => a.id))) {
    issues.push({ message: `duplicate illustration id "${id}"` });
  }

  for (const technology of catalog.technologies) {
    const owner = `technology "${technology.id}"`;
    for (const prerequisite of technology.prerequisites) {
      if (!technologyIds.has(prerequisite)) {
        issues.push({ message: `${owner}: unknown prerequisite "${prerequisite}"` });
      }
    }
    checkEffects(owner, technology.effects, issues);
    if (!illustrationIds.has(technology.illustrationId)) {
      issues.push({ message: `${owner}: missing illustration "${technology.illustrationId}"` });
    }
    if (!worldIds.has(technology.worldAdditionId)) {
      issues.push({ message: `${owner}: missing world addition "${technology.worldAdditionId}"` });
    }
    if (!catalog.upgrades.some((u) => u.discovers === technology.id)) {
      issues.push({ message: `${owner}: no upgrade discovers it` });
    }
  }

  for (const upgrade of catalog.upgrades) {
    const owner = `upgrade "${upgrade.id}"`;
    if (!Number.isFinite(upgrade.basePrice) || upgrade.basePrice < 0) {
      issues.push({ message: `${owner}: invalid price ${upgrade.basePrice}` });
    }
    if (!Number.isFinite(upgrade.priceGrowth) || upgrade.priceGrowth < 1) {
      issues.push({ message: `${owner}: invalid price growth ${upgrade.priceGrowth}` });
    }
    if (!Number.isInteger(upgrade.maxLevel) || upgrade.maxLevel < 1) {
      issues.push({ message: `${owner}: invalid max level ${upgrade.maxLevel}` });
    }
    if (upgrade.discovers !== undefined && !technologyIds.has(upgrade.discovers)) {
      issues.push({ message: `${owner}: discovers unknown technology "${upgrade.discovers}"` });
    }
    for (const id of upgrade.requires.technologies ?? []) {
      if (!technologyIds.has(id))
        issues.push({ message: `${owner}: requires unknown technology "${id}"` });
    }
    checkEffects(owner, upgrade.effectsPerLevel, issues);
  }

  const cycle = findCycle(catalog);
  if (cycle) issues.push({ message: `prerequisite cycle: ${cycle.join(' → ')}` });

  return issues;
}
