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

  checkReleases(catalog, issues);
  checkChatter(catalog, issues);
  return issues;
}

/** Ship It content: five windows in catalog order with growing prices, odds summing to 20 %. */
function checkReleases(catalog: Catalog, issues: ContentIssue[]): void {
  const { windows, slices, comments } = catalog.releases;
  if (windows.length !== 5) issues.push({ message: `releases: ${windows.length} windows, not 5` });
  const order = catalog.technologies.map((t) => t.id as string);
  windows.forEach((window, i) => {
    const previous = windows[i - 1];
    if (!order.includes(window.technology)) {
      issues.push({
        message: `release ${window.version}: unknown technology "${window.technology}"`,
      });
    }
    if (previous && order.indexOf(window.technology) <= order.indexOf(previous.technology)) {
      issues.push({ message: `release ${window.version}: technologies out of catalog order` });
    }
    if (previous && window.price <= previous.price) {
      issues.push({ message: `release ${window.version}: price does not increase` });
    }
  });
  const weights = windows.reduce((sum, w) => sum + w.jackpotWeight, 0);
  if (Math.abs(weights - 20) > 1e-9) {
    issues.push({ message: `releases: jackpot weights sum to ${weights}, not 20` });
  }
  for (const slice of slices) {
    const labels =
      typeof slice.label === 'string' ? [slice.label] : [slice.label.alive, slice.label.absent];
    if (labels.some((label) => label.length === 0 || label.length > 10)) {
      issues.push({ message: `release slice "${slice.id}": label must be 1–10 characters` });
    }
    const texts =
      typeof slice.text === 'string' ? [slice.text] : [slice.text.alive, slice.text.absent];
    if (texts.some((text) => text.length === 0)) {
      issues.push({ message: `release slice "${slice.id}": empty text` });
    }
  }
  if (slices.length < windows.length) {
    issues.push({ message: 'releases: fewer slices than windows (outcomes would repeat)' });
  }
  if (comments.length < windows.length) {
    issues.push({ message: 'releases: fewer comments than windows (comments would repeat)' });
  }
  for (const comment of comments) {
    if (comment.text.length > 140) {
      issues.push({ message: `release comment "${comment.id}": longer than 140 characters` });
    }
  }
  for (const id of duplicates(comments.map((c) => c.id))) {
    issues.push({ message: `duplicate release comment id "${id}"` });
  }
  if (!catalog.endings.some((e) => e.id === catalog.releases.jackpotEnding && e.jackpot)) {
    issues.push({
      message: `releases: jackpot ending "${catalog.releases.jackpotEnding}" is missing`,
    });
  }
}

/** Console chatter: every technology talks, 10–15 short lines each, no line used twice. */
function checkChatter(catalog: Catalog, issues: ContentIssue[]): void {
  const all: string[] = [];
  for (const technology of catalog.technologies) {
    const pool = catalog.chatter[technology.id] ?? [];
    if (pool.length < 10 || pool.length > 15) {
      issues.push({ message: `chatter "${technology.id}": ${pool.length} lines, needs 10–15` });
    }
    for (const line of pool) {
      if (line.length === 0 || line.length > 140) {
        issues.push({
          message: `chatter "${technology.id}": a line is empty or over 140 characters`,
        });
      }
    }
    all.push(...pool);
  }
  for (const line of duplicates(all))
    issues.push({ message: `chatter line used twice: "${line}"` });
}
