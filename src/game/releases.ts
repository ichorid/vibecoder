/**
 * Ship It: launch windows, the jackpot hazard and the release draw. Window state is derived
 * from History (when the window's technology was unlocked) and `releases`, never stored.
 * The draw uses only `rng.release`, so an outcome depends on the seed and on how many releases
 * were shipped — not on when, and not on a reload.
 */
import type { CatAwareText, Catalog, ReleaseWindowDefinition } from './catalog';
import { endRun } from './endings';
import { appendLog } from './log';
import { nextFloat, nextInt } from './random';
import { roundAmount } from './economy';
import type { Transition } from './simulation';
import type { GameFact, ReadonlyRun, ReleaseRecord, RunState } from './types';

/**
 * The chance shown on the wheel at window `index`: its weight over what is left of 100 %, so a
 * player who ships every time wins at window k with probability exactly `weight_k` %.
 */
export function jackpotHazard(windows: readonly ReleaseWindowDefinition[], index: number): number {
  const before = windows.slice(0, index).reduce((sum, w) => sum + w.jackpotWeight, 0);
  return (windows[index]?.jackpotWeight ?? 0) / (100 - before);
}

/** History index of the unlock that opened this window, or -1. */
function openingIndex(run: ReadonlyRun, window: ReleaseWindowDefinition): number {
  return run.history.findIndex((e) => e.kind === 'technology' && e.id === window.technology);
}

export type WindowState = 'unopened' | 'open' | 'shipped' | 'closed';

export function releaseWindowState(
  run: ReadonlyRun,
  window: ReleaseWindowDefinition,
  catalog: Catalog,
): WindowState {
  if (run.releases.some((r) => r.window === window.window)) return 'shipped';
  const index = openingIndex(run, window);
  const opened = run.history[index];
  if (!opened) return 'unopened';
  const windows = catalog.releases.windows;
  if (window.window === windows[windows.length - 1]?.window) return 'open';
  const laterTechnologies = run.history.slice(index + 1).filter((e) => e.kind === 'technology');
  const closed =
    laterTechnologies.length >= catalog.releases.closeAfterTechnologies &&
    run.activeMs - opened.activeMs >= catalog.releases.closeAfterMs;
  return closed ? 'closed' : 'open';
}

/** The window a release can be shipped in right now (the earliest open one), if any. */
export function openReleaseWindow(
  run: ReadonlyRun,
  catalog: Catalog,
): ReleaseWindowDefinition | null {
  if (run.status !== 'playing') return null;
  return (
    catalog.releases.windows.find((w) => releaseWindowState(run, w, catalog) === 'open') ?? null
  );
}

/** Resolve cat-aware text by whether the cat was there. */
export function catAware(text: CatAwareText, catAlive: boolean): string {
  return typeof text === 'string' ? text : catAlive ? text.alive : text.absent;
}

/** The wheel label a release record landed on. */
export function releaseLabel(record: ReleaseRecord, catalog: Catalog): string {
  if (record.outcome === 'jackpot') return catalog.releases.jackpotLabel;
  const slice = catalog.releases.slices.find((s) => s.id === record.outcome);
  return slice ? catAware(slice.label, record.catAlive) : record.outcome;
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');

type ShipResult =
  | { readonly accepted: true; readonly transition: Transition }
  | { readonly accepted: false; readonly reason: 'unavailable' | 'unaffordable' };

/**
 * Ship a release in the open window: spend its price from the code balance, draw jackpot →
 * unused slice → unused comment from `rng.release`, record it with the cat's presence, and log
 * it. A jackpot ends the run with the jackpot ending in the same transition.
 */
export function shipRelease(run: RunState, catalog: Catalog): ShipResult {
  const window = openReleaseWindow(run, catalog);
  if (!window) return { accepted: false, reason: 'unavailable' };
  if (run.economy.output < window.price) return { accepted: false, reason: 'unaffordable' };
  const content = catalog.releases;
  const index = content.windows.indexOf(window);

  let rng = run.rng.release;
  const roll = nextFloat(rng);
  rng = roll.state;
  const jackpot = roll.value < jackpotHazard(content.windows, index);
  let outcome: ReleaseRecord['outcome'] = 'jackpot';
  let commentId: string | null = null;
  if (!jackpot) {
    const usedSlices = new Set(run.releases.map((r) => r.outcome));
    const slices = content.slices.filter((s) => !usedSlices.has(s.id));
    const slice = nextInt(rng, 0, slices.length - 1);
    rng = slice.state;
    outcome = slices[slice.value]?.id ?? 'three-users';
    const usedComments = new Set(run.releases.map((r) => r.commentId));
    const comments = content.comments.filter((c) => !usedComments.has(c.id));
    const comment = nextInt(rng, 0, comments.length - 1);
    rng = comment.state;
    commentId = comments[comment.value]?.id ?? null;
  }

  const record: ReleaseRecord = {
    window: window.window,
    outcome,
    commentId,
    catAlive: run.cat.alive,
    activeMs: run.activeMs,
  };
  const shipped = appendLog(
    {
      ...run,
      rng: { ...run.rng, release: rng },
      economy: { ...run.economy, output: roundAmount(run.economy.output - window.price) },
      releases: [...run.releases, record],
      history: [
        ...run.history,
        { kind: 'release', window: window.window, outcome, activeMs: run.activeMs },
      ],
    },
    `📦 ${fill(content.shippedText, { version: window.version, label: releaseLabel(record, catalog) })}`,
    catalog,
  );
  const facts: GameFact[] = [{ type: 'releaseShipped', window: window.window, outcome }];
  if (!jackpot) return { accepted: true, transition: { run: shipped, facts } };
  const ended = endRun(shipped, content.jackpotEnding);
  return { accepted: true, transition: { run: ended.run, facts: [...facts, ...ended.facts] } };
}

/**
 * Log lines for windows that opened or closed (unshipped) since the last step, once each;
 * `narrative.fired` remembers which were said.
 */
export function releaseNotices(run: RunState, catalog: Catalog): RunState {
  if (run.status !== 'playing') return run;
  let next = run;
  for (const window of catalog.releases.windows) {
    const state = releaseWindowState(next, window, catalog);
    const notices: [string, string][] = [];
    if (state !== 'unopened')
      notices.push([`release-open-${window.window}`, `🚢 ${window.description}`]);
    if (state === 'closed') {
      notices.push([
        `release-closed-${window.window}`,
        `⌛ ${fill(catalog.releases.closedText, { version: window.version })}`,
      ]);
    }
    for (const [id, text] of notices) {
      if (next.narrative.fired.includes(id)) continue;
      next = appendLog(
        { ...next, narrative: { ...next.narrative, fired: [...next.narrative.fired, id] } },
        text,
        catalog,
      );
    }
  }
  return next;
}
