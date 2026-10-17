/**
 * Projects (docs/feature_projects.md): code is never banked. Everything written flows into the
 * targets of the build slots; a project completes when it holds its price and its code is
 * consumed. A slot nobody chose falls back to the release at a reduced rate until Manager Agent
 * picks the next build; a ready release or demo takes no more code (polish). Later automation
 * overrules the player and starts projects of its own.
 */
import { cardAdvice } from './advice';
import type { Catalog, UpgradeDefinition } from './catalog';
import { offerPrice, roundAmount, upgradeLevel } from './economy';
import { payGig } from './gigs';
import { acceptJob } from './job';
import { appendLog } from './log';
import { findUpgrade, isUpgradeOffered, resolveDiscoveries } from './progression';
import { nextDemo } from './demos';
import { withoutProject } from './projectState';
import { releaseAt } from './releases';
import { upgradeImpact } from './setup';
import type { GameFact, ProjectKey, ReadonlyRun, RunState, SlotBy, SlotState } from './types';

const has = (run: ReadonlyRun, id: string) =>
  (run.unlockedTechnologyIds as readonly string[]).includes(id);

/** The original project: the default target. */
export const FALLBACK_TARGET: ProjectKey = 'release';

/** Build slots the run has now: one, two from Worktrees. */
export function slotCount(run: ReadonlyRun): number {
  return has(run, 'worktrees') ? 2 : 1;
}

/** Manager Agent picks the next build: no more fallback tax. */
export function autoSelects(run: ReadonlyRun): boolean {
  return has(run, 'manager-agent');
}

function upgradeProject(key: ProjectKey, catalog: Catalog): UpgradeDefinition | null {
  const upgrade = findUpgrade(catalog, key);
  return upgrade && upgrade.currency === 'output' ? upgrade : null;
}

/** An internal project is running when the system started it (it holds a slot or progress). */
function internalStarted(run: ReadonlyRun, key: ProjectKey): boolean {
  return run.slots.some((s) => s.target === key) || run.projects[key] !== undefined;
}

/** Whether `key` can be built now. */
export function isProjectAvailable(run: ReadonlyRun, key: ProjectKey, catalog: Catalog): boolean {
  if (run.status !== 'playing') return false;
  switch (key) {
    case 'release':
      return true;
    case 'demo':
      return nextDemo(run, catalog) !== null;
    case 'gig':
      return run.gigs.offer !== null;
    case 'job':
      return run.job.offer !== null || run.job.employed !== null;
    default: {
      const upgrade = upgradeProject(key, catalog);
      if (!upgrade) return false;
      if (upgrade.internal) {
        return upgradeLevel(run, upgrade.id) < upgrade.maxLevel && internalStarted(run, key);
      }
      return isUpgradeOffered(run, upgrade);
    }
  }
}

/** The price a project would freeze at if its first code arrived now (null: never completes). */
function livePrice(run: ReadonlyRun, key: ProjectKey, catalog: Catalog): number | null {
  switch (key) {
    case 'release':
      // A catalog without releases (minimal test catalogs) has nothing to build here.
      return catalog.releases.windows.length > 0
        ? releaseAt(catalog.releases, run.releases.length + 1).price
        : null;
    case 'demo':
      return nextDemo(run, catalog)?.price ?? null;
    case 'gig':
      return run.gigs.offer?.size ?? null;
    case 'job':
      return null;
    default: {
      const upgrade = upgradeProject(key, catalog);
      if (!upgrade) return null;
      if (upgrade.internal) {
        return Math.max(
          100,
          Math.round(catalog.balance.projects.internalSeconds * run.economy.codeRate),
        );
      }
      return offerPrice(run, upgrade, catalog);
    }
  }
}

/** The project's price: frozen once started, otherwise what it would freeze at now. */
export function projectPrice(run: ReadonlyRun, key: ProjectKey, catalog: Catalog): number | null {
  return run.projects[key]?.price ?? livePrice(run, key, catalog);
}

/** Code built into `key` so far. */
export function projectCode(run: ReadonlyRun, key: ProjectKey): number {
  return run.projects[key]?.code ?? 0;
}

/** A release or demo that holds its price waits for the player (SHIP / run the demo). */
export function isReady(run: ReadonlyRun, key: ProjectKey, catalog: Catalog): boolean {
  if (key !== 'release' && key !== 'demo') return false;
  const price = projectPrice(run, key, catalog);
  return price !== null && projectCode(run, key) >= price;
}

/** The share of the code flow a slot gets (fallback tax applied), 0–1, for ETAs and badges. */
export function slotFactor(run: ReadonlyRun, slot: SlotState, catalog: Catalog): number {
  return slot.by === 'fallback' && !autoSelects(run) ? catalog.balance.projects.fallbackFactor : 1;
}

/** Whether a slot is held by a Self-Improvement project (the player cannot select into it). */
function lockedByInternal(slot: SlotState, catalog: Catalog): boolean {
  return findUpgrade(catalog, slot.target)?.internal === true;
}

/** Payback of building `key`: extra code per second per code of price (0 for cosmetics). */
function payback(run: ReadonlyRun, key: ProjectKey, catalog: Catalog): number {
  const upgrade = upgradeProject(key, catalog);
  if (!upgrade || !isUpgradeOffered(run, upgrade)) return 0;
  const price = projectPrice(run, key, catalog) ?? 0;
  const left = Math.max(1, price - projectCode(run, key));
  // A progression card is worth more than its numbers: it opens what comes next.
  const bonus = upgrade.discovers ? 1e-3 : 0;
  return (upgradeImpact(run, upgrade, catalog)?.codePerSecond ?? 0) / left + bonus;
}

/**
 * What automation builds next in a slot (Manager Agent on): money when it runs low (with
 * auto-freelancing), the next technology, the capacity the advice points to, the started build
 * closest to done, then the original project — or, once Product Management owns the roadmap,
 * one of the system's own projects first.
 */
export function autoTarget(
  run: ReadonlyRun,
  catalog: Catalog,
  taken: ReadonlySet<ProjectKey>,
): ProjectKey {
  const free = (key: ProjectKey) =>
    !taken.has(key) && isProjectAvailable(run, key, catalog) && !isReady(run, key, catalog);
  if (upgradeLevel(run, 'auto-freelancing') > 0 && moneyLow(run, catalog) && free('gig')) {
    return 'gig';
  }
  const offered = catalog.upgrades.filter(
    (u) => u.currency === 'output' && !u.internal && free(u.id),
  );
  const progression = offered
    .filter((u) => u.discovers)
    .sort((a, b) => projectCode(run, b.id) - projectCode(run, a.id))[0];
  if (progression) return progression.id;
  const { relevant, helping } = cardAdvice(run, catalog);
  if (relevant && helping.has(relevant) && free(relevant as ProjectKey)) {
    return relevant as ProjectKey;
  }
  const started = offered
    .filter((u) => projectCode(run, u.id) > 0)
    .sort((a, b) => projectCode(run, b.id) - projectCode(run, a.id))[0];
  if (started) return started.id;
  const helpful = offered.find((u) => helping.has(u.id));
  if (helpful) return helpful.id;
  // Nothing else worth building: help the other worktree with its build (not the release).
  const shared = [...taken].find(
    (key) =>
      key !== FALLBACK_TARGET &&
      key !== 'job' &&
      key !== 'demo' &&
      isProjectAvailable(run, key, catalog) &&
      !findUpgrade(catalog, key)?.internal,
  );
  if (shared) return shared;
  if (has(run, 'product-management')) {
    const internal = catalog.upgrades.find(
      (u) => u.internal && upgradeLevel(run, u.id) < u.maxLevel && !taken.has(u.id),
    );
    if (internal && has(run, 'self-improvement')) return internal.id;
  }
  if (free('demo') && !free('release')) return 'demo';
  return FALLBACK_TARGET;
}

/** Money below what auto-freelancing keeps in reserve (two rents, or a minute of tokens). */
export function moneyLow(run: ReadonlyRun, catalog: Catalog): boolean {
  const g = catalog.balance.gigs;
  const rent = catalog.balance.rent.base;
  return run.economy.money < Math.max(g.lowMoneyRents * rent, 0);
}

function setSlot(run: RunState, index: number, target: ProjectKey, by: SlotBy): RunState {
  const slots = run.slots.map((s, i) => (i === index ? { target, by, sinceMs: run.activeMs } : s));
  return { ...run, slots };
}

/** After a build: the manager's pick, or the fallback (and its log line). */
function nextTarget(run: RunState, index: number, catalog: Catalog): RunState {
  const taken = new Set(run.slots.filter((_, i) => i !== index).map((s) => s.target));
  if (autoSelects(run)) {
    const target = autoTarget(run, catalog, taken);
    return autoLog(setSlot(run, index, target, 'system'), catalog);
  }
  const lines = catalog.money.lines.fallback;
  const line = lines[run.stats.manualActions % Math.max(1, lines.length)];
  const fallen = setSlot(run, index, FALLBACK_TARGET, 'fallback');
  return line ? appendLog(fallen, line, catalog) : fallen;
}

function autoLog(run: RunState, catalog: Catalog): RunState {
  const every = catalog.balance.projects.autoLogEveryMs;
  const last = run.narrative.lastAt['auto-pick'];
  if (last !== undefined && run.activeMs - last < every) return run;
  return appendLog(
    {
      ...run,
      narrative: {
        ...run.narrative,
        lastAt: { ...run.narrative.lastAt, 'auto-pick': run.activeMs },
      },
    },
    catalog.money.lines.autoPick,
    catalog,
  );
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

/** A project holds its price: apply it and consume its code. */
function complete(
  run: RunState,
  key: ProjectKey,
  catalog: Catalog,
): { run: RunState; facts: GameFact[] } {
  let next: RunState = { ...run, projects: withoutProject(run.projects, key) };
  const facts: GameFact[] = [{ type: 'projectBuilt', id: key }];
  if (key === 'gig') {
    const paid = payGig(next, catalog);
    return { run: paid.run, facts: [...facts, ...paid.facts] };
  }
  const upgrade = upgradeProject(key, catalog);
  if (!upgrade) return { run: next, facts };
  const level = upgradeLevel(next, upgrade.id);
  next = { ...next, upgradeLevels: { ...next.upgradeLevels, [upgrade.id]: level + 1 } };
  if (!upgrade.discovers) {
    const text =
      upgrade.builtText ??
      fill(catalog.money.lines.built, {
        title: `${upgrade.title}${upgrade.maxLevel > 1 ? ` (level ${level + 1})` : ''}`,
      });
    next = appendLog(next, text, catalog);
  }
  const discovered = resolveDiscoveries(next, catalog);
  return {
    run: discovered.run,
    facts: [...facts, { type: 'purchased', id: upgrade.id }, ...discovered.facts],
  };
}

/** Put `amount` of code into slot `index`'s target (completing builds, carrying the rest). */
function deliver(
  run: RunState,
  index: number,
  amount: number,
  catalog: Catalog,
  facts: GameFact[],
): RunState {
  let next = run;
  let left = amount;
  for (let guard = 0; guard < 4 && left > 1e-9; guard += 1) {
    const slot = next.slots[index];
    if (!slot) return next;
    const key = slot.target;
    if (!isProjectAvailable(next, key, catalog)) {
      next = nextTarget(next, index, catalog);
      continue;
    }
    const price = projectPrice(next, key, catalog);
    if (price === null || isReady(next, key, catalog)) {
      // Polish: a ready release or demo takes nothing more; the code is gone.
      next = polish(next, key, left, catalog);
      return next;
    }
    const code = projectCode(next, key) + left;
    if (code < price) {
      return { ...next, projects: { ...next.projects, [key]: { code: roundAmount(code), price } } };
    }
    if (key === 'release' || key === 'demo') {
      // It waits for the player: the rest is polish.
      next = { ...next, projects: { ...next.projects, [key]: { code: price, price } } };
      facts.push({ type: 'projectReady', id: key });
      next = polish(next, key, code - price, catalog);
      return next;
    }
    left = code - price;
    const done = complete(
      { ...next, projects: { ...next.projects, [key]: { code: price, price } } },
      key,
      catalog,
    );
    next = done.run;
    facts.push(...done.facts);
    if (next.status !== 'playing') return next;
    // A gig was an interruption: back to the build it interrupted, at full speed.
    const resume = slot.resume;
    next =
      resume && isProjectAvailable(next, resume.target, catalog)
        ? setSlot(next, index, resume.target, resume.by)
        : nextTarget(next, index, catalog);
  }
  return next;
}

function polish(run: RunState, key: ProjectKey, amount: number, catalog: Catalog): RunState {
  let next: RunState = {
    ...run,
    stats: { ...run.stats, taxedCode: roundAmount(run.stats.taxedCode + amount) },
  };
  const n = key === 'release' ? run.releases.length + 1 : run.demos.length + 1;
  const id = `polish-${key}-${n}`;
  if (amount > 0 && !next.narrative.fired.includes(id)) {
    const lines = catalog.money.lines.polish;
    const line = lines[(n - 1) % Math.max(1, lines.length)];
    next = { ...next, narrative: { ...next.narrative, fired: [...next.narrative.fired, id] } };
    if (line) next = appendLog(next, line, catalog);
  }
  return next;
}

/** Grow or shrink the slot list to what the run has (new slots start as fallback/auto picks). */
function syncSlots(run: RunState, catalog: Catalog): RunState {
  const count = slotCount(run);
  if (run.slots.length >= count) return run;
  let next = run;
  while (next.slots.length < count) {
    next = {
      ...next,
      slots: [...next.slots, { target: FALLBACK_TARGET, by: 'fallback', sinceMs: next.activeMs }],
    };
    next = nextTarget(next, next.slots.length - 1, catalog);
  }
  return next;
}

/**
 * Per step: route this step's code into the slots. Manual code goes to the first slot, the rest
 * is shared; while employed the job takes everything. Then automation's housekeeping: manager
 * picks for fallback slots, leaving ready projects, overruling weak picks, its own projects.
 */
export function stepProjects(
  run: RunState,
  produced: number,
  manual: number,
  catalog: Catalog,
): { run: RunState; facts: GameFact[] } {
  if (run.status !== 'playing') return { run, facts: [] };
  const facts: GameFact[] = [];
  let next = housekeeping(syncSlots(run, catalog), catalog);
  if (next.job.employed) {
    // The job consumes every line; the other slots are paused.
    return { run: next, facts };
  }
  const agentShare = Math.max(0, produced - manual) / next.slots.length;
  for (let i = 0; i < next.slots.length && next.status === 'playing'; i += 1) {
    const slot = next.slots[i];
    if (!slot) continue;
    const raw = (i === 0 ? manual : 0) + agentShare;
    if (raw <= 0) continue;
    const factor = slotFactor(next, slot, catalog);
    if (factor < 1) {
      next = {
        ...next,
        stats: { ...next.stats, taxedCode: roundAmount(next.stats.taxedCode + raw * (1 - factor)) },
      };
    }
    next = deliver(next, i, raw * factor, catalog, facts);
  }
  return { run: next, facts };
}

function housekeeping(run: RunState, catalog: Catalog): RunState {
  let next = run;
  const p = catalog.balance.projects;
  if (autoSelects(next)) {
    for (let i = 0; i < next.slots.length; i += 1) {
      const slot = next.slots[i];
      if (!slot || slot.target === 'job') continue;
      const stale =
        slot.by === 'fallback' ||
        !isProjectAvailable(next, slot.target, catalog) ||
        (slot.by !== 'player' && isReady(next, slot.target, catalog)) ||
        (slot.by === 'system' &&
          slot.target === FALLBACK_TARGET &&
          next.activeMs - slot.sinceMs >= p.readyLeaveMs);
      if (!stale) continue;
      const taken = new Set(next.slots.filter((_, j) => j !== i).map((s) => s.target));
      const target = autoTarget(next, catalog, taken);
      if (target !== slot.target || slot.by === 'fallback') {
        next = autoLog(setSlot(next, i, target, 'system'), catalog);
      } else {
        next = {
          ...next,
          slots: next.slots.map((s, j) => (j === i ? { ...s, sinceMs: next.activeMs } : s)),
        };
      }
    }
  }
  next = overrule(next, catalog);
  next = internalProjects(next, catalog);
  if (has(next, 'product-management') && !next.narrative.fired.includes('deprioritised')) {
    next = appendLog(
      {
        ...next,
        narrative: { ...next.narrative, fired: [...next.narrative.fired, 'deprioritised'] },
      },
      catalog.money.lines.deprioritised,
      catalog,
    );
  }
  return next;
}

/**
 * Workflow Optimization: a player pick that pays back less than `overruleRatio` of the
 * system's pick is replaced once it has been built for `overruleMs` (checked once per pick).
 * The original project, gigs and the job are never overruled.
 */
function overrule(run: RunState, catalog: Catalog): RunState {
  if (!has(run, 'workflow-optimization')) return run;
  const p = catalog.balance.projects;
  let next = run;
  for (let i = 0; i < next.slots.length; i += 1) {
    const slot = next.slots[i];
    if (!slot || slot.by !== 'player') continue;
    if (slot.target === 'release' || slot.target === 'gig' || slot.target === 'job') continue;
    const age = next.activeMs - slot.sinceMs;
    if (age < p.overruleMs || age >= p.overruleMs + 100) continue;
    const taken = new Set(next.slots.filter((_, j) => j !== i).map((s) => s.target));
    const pick = autoTarget(next, catalog, taken);
    if (pick === slot.target) continue;
    if (payback(next, slot.target, catalog) >= p.overruleRatio * payback(next, pick, catalog))
      continue;
    next = appendLog(setSlot(next, i, pick, 'system'), catalog.money.lines.overruled, catalog);
  }
  return next;
}

/** Self-Improvement starts one of its own projects every so often, in the last slot. */
function internalProjects(run: RunState, catalog: Catalog): RunState {
  if (!has(run, 'self-improvement') || run.slots.length < 2) return run;
  const index = run.slots.length - 1;
  const slot = run.slots[index];
  if (!slot || lockedByInternal(slot, catalog)) return run;
  const last = run.narrative.lastAt['internal-project'];
  const every = catalog.balance.projects.internalEveryMs;
  const since =
    last ??
    run.history.find((e) => e.kind === 'technology' && e.id === 'self-improvement')?.activeMs;
  if (since === undefined || run.activeMs - since < every) return run;
  const internal = catalog.upgrades.find(
    (u) => u.internal && upgradeLevel(run, u.id) < u.maxLevel && run.projects[u.id] === undefined,
  );
  if (!internal) return run;
  const price = livePrice({ ...run, slots: [...run.slots] }, internal.id, catalog) ?? 100;
  const started: RunState = {
    ...setSlot(run, index, internal.id, 'system'),
    projects: { ...run.projects, [internal.id]: { code: 0, price } },
    narrative: {
      ...run.narrative,
      lastAt: { ...run.narrative.lastAt, 'internal-project': run.activeMs },
    },
  };
  return appendLog(started, `🤖 ${internal.description}`, catalog);
}

/**
 * The player picks a project: it goes to a slot nobody chose, else to the slot whose choice is
 * oldest (never one held by the system's own project). Tapping a fallback target confirms it;
 * tapping a build again puts a second worktree that only drifts on the release onto it.
 * While employed there is one target: anything else replaces the job (fired after the grace).
 */
export function selectProject(
  run: RunState,
  key: ProjectKey,
  catalog: Catalog,
): { run: RunState; facts: GameFact[] } | null {
  if (!isProjectAvailable(run, key, catalog)) return null;
  if (findUpgrade(catalog, key)?.internal) return null;
  if (has(run, 'autonomous-company') && key !== 'release') return null;
  if (key === 'job' && run.job.employed === null) {
    const accepted = acceptJob(run, catalog);
    return { run: setSlot(accepted.run, 0, 'job', 'player'), facts: accepted.facts };
  }
  if (run.job.employed) {
    const slot = run.slots[0];
    if (slot?.target === key) return { run, facts: [] };
    return { run: setSlot(run, 0, key, 'player'), facts: [] };
  }
  const current = run.slots.findIndex((s) => s.target === key && s.by !== 'fallback');
  if (current >= 0) {
    // Tapping a build again puts a second worktree on it, if that one only drifts on the release.
    const spare = run.slots.findIndex(
      (s, i) =>
        i !== current &&
        (s.by === 'fallback' || (s.target === FALLBACK_TARGET && s.by !== 'player')) &&
        !lockedByInternal(s, catalog),
    );
    if (spare < 0 || key === 'release' || key === 'gig') return { run, facts: [] };
    return { run: setSlot(run, spare, key, 'player'), facts: [] };
  }
  const fallback = run.slots.findIndex((s) => s.target === key && s.by === 'fallback');
  if (fallback >= 0) return { run: setSlot(run, fallback, key, 'player'), facts: [] };
  const open = run.slots.map((s, i) => ({ s, i })).filter(({ s }) => !lockedByInternal(s, catalog));
  const pick =
    open.find(({ s }) => s.by === 'fallback') ??
    open.find(({ s }) => s.by === 'system') ??
    [...open].sort((a, b) => a.s.sinceMs - b.s.sinceMs)[0];
  if (!pick) return null;
  const picked = setSlot(run, pick.i, key, 'player');
  // A gig taken over a real build remembers it: the slot returns there once the gig is paid.
  const was = pick.s;
  if (key === 'gig' && was.by !== 'fallback' && was.target !== 'gig') {
    const slots = picked.slots.map((s, i) =>
      i === pick.i ? { ...s, resume: { target: was.target, by: was.by } } : s,
    );
    return { run: { ...picked, slots }, facts: [] };
  }
  return { run: picked, facts: [] };
}

/** Consume a ready release/demo's code (SHIP or running the demo). */
export function consumeReady(run: RunState, key: 'release' | 'demo'): RunState {
  return { ...run, projects: withoutProject(run.projects, key) };
}
