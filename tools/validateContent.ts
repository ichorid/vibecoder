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
  checkDemos(catalog, issues);
  checkChatter(catalog, issues);
  checkCatTexts(catalog, issues);
  return issues;
}

/** Ship It content: five authored releases with growing prices, odds summing to 20 %. */
function checkReleases(catalog: Catalog, issues: ContentIssue[]): void {
  const { windows, slices, comments } = catalog.releases;
  if (windows.length !== 5) issues.push({ message: `releases: ${windows.length} authored, not 5` });
  if (!catalog.technologies.some((t) => t.id === catalog.releases.availableFrom)) {
    issues.push({ message: `releases: unknown technology "${catalog.releases.availableFrom}"` });
  }
  windows.forEach((window, i) => {
    const previous = windows[i - 1];
    if (window.window !== i + 1) {
      issues.push({
        message: `release ${window.version}: numbered ${window.window}, not ${i + 1}`,
      });
    }
    if (previous && window.price <= previous.price) {
      issues.push({ message: `release ${window.version}: price does not increase` });
    }
  });
  if (catalog.releases.laterPriceGrowth <= 1) {
    issues.push({ message: 'releases: later releases must cost more each time' });
  }
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
    issues.push({ message: 'releases: fewer slices than releases (outcomes would repeat)' });
  }
  if (comments.length < windows.length) {
    issues.push({ message: 'releases: fewer comments than releases (comments would repeat)' });
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

/** Demos: a real price ladder, enough names and lines that a demo never repeats one. */
function checkDemos(catalog: Catalog, issues: ContentIssue[]): void {
  const d = catalog.demos;
  if (!catalog.technologies.some((t) => t.id === d.availableFrom)) {
    issues.push({ message: `demos: unknown technology "${d.availableFrom}"` });
  }
  if (!(d.basePrice > 0) || !(d.priceGrowth > 1)) {
    issues.push({ message: 'demos: price must be positive and grow' });
  }
  const minimum: [string, number, number][] = [
    ['groups', d.groups.length, 4],
    ['titleFirst', d.titleFirst.length, 4],
    ['titleSecond', d.titleSecond.length, 4],
    ['greetings', d.greetings.length, 5],
    ['scroller', d.scroller.length, 3],
  ];
  for (const [name, count, min] of minimum) {
    if (count < min) issues.push({ message: `demos: ${name} needs at least ${min} entries` });
  }
  const texts = [...d.greetings, ...d.scroller].flatMap((t) =>
    typeof t === 'string' ? [t] : [t.alive, t.absent],
  );
  for (const text of [...texts, ...d.groups, ...d.titleFirst, ...d.titleSecond]) {
    if (text.length === 0 || text.length > 140) {
      issues.push({ message: `demos: "${text.slice(0, 30)}" is empty or over 140 characters` });
    }
  }
  for (const id of duplicates([...d.groups, ...d.titleFirst, ...d.titleSecond])) {
    issues.push({ message: `demos: "${id}" used twice` });
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

const MENTIONS_CAT = /\bcat\b|\bcat['’]s\b/i;

/**
 * "If there is no cat, there is no cat": a text that can show while the cat is gone and names
 * it must be cat-aware ({ alive, absent }). Achievement titles are history and may name it.
 */
function checkCatTexts(catalog: Catalog, issues: ContentIssue[]): void {
  const plain: [string, string][] = [
    ...catalog.technologies.flatMap((t): [string, string][] =>
      typeof t.description === 'string' ? [[`technology "${t.id}"`, t.description]] : [],
    ),
    ...catalog.events.flatMap((e): [string, string][] =>
      typeof e.text === 'string' ? [[`event "${e.id}"`, e.text]] : [],
    ),
    ...catalog.upgrades.flatMap((u): [string, string][] => [
      [`upgrade "${u.id}"`, `${u.title} ${u.description}`],
    ]),
    ...Object.entries(catalog.chatter).flatMap(([id, lines]): [string, string][] =>
      (lines ?? []).map((line): [string, string] => [`chatter "${id}"`, line]),
    ),
    ...[...catalog.demos.greetings, ...catalog.demos.scroller].flatMap((t): [string, string][] =>
      typeof t === 'string' ? [['demo text', t]] : [],
    ),
    ['demo', `${catalog.demos.title} ${catalog.demos.notice} ${catalog.demos.madeText}`],
    ...catalog.choices.flatMap((c): [string, string][] =>
      typeof c.description === 'string'
        ? [[`choice "${c.id}"`, `${c.title} ${c.description}`]]
        : [],
    ),
  ];
  for (const [owner, text] of plain) {
    const onlyWhileAlive = owner === 'event "cat-helping"';
    if (MENTIONS_CAT.test(text) && !onlyWhileAlive) {
      issues.push({ message: `${owner}: mentions the cat without a version for when it is gone` });
    }
  }
}
