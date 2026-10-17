/**
 * Ship It: the original project is the default build target (docs/feature_projects.md §5.5);
 * once it holds the next release's price it waits for the player, who can ship it once the
 * project works. The jackpot hazard is fixed per release number; the draw uses only
 * `rng.release`, so an outcome depends on the seed and on how many releases were shipped — not
 * on when, and not on a reload.
 */
import type { Catalog, ReleaseContent, ReleaseWindowDefinition } from './catalog';
import { catAware } from './catAware';
import { endRun } from './endings';
import { appendLog } from './log';
import { withoutProject } from './projectState';
import { nextFloat, nextInt } from './random';
import type { Transition } from './simulation';
import type { GameFact, ReadonlyRun, ReleaseRecord, RunState } from './types';

/** Release number `n` (1-based): authored, or generated after the last authored one. */
export function releaseAt(content: ReleaseContent, n: number): ReleaseWindowDefinition {
  const authored = content.windows[n - 1];
  if (authored) return authored;
  const last = content.windows[content.windows.length - 1];
  if (!last) throw new Error('no releases authored');
  const extra = n - content.windows.length;
  const major = Number(/v(\d+)/.exec(last.version)?.[1] ?? '0') + extra;
  const version = `v${major}.0`;
  return {
    window: n,
    version,
    price: last.price * content.laterPriceGrowth ** extra,
    jackpotWeight: last.jackpotWeight,
    title: `Ship ${version}`,
    description: content.laterDescription,
  };
}

/**
 * The chance shown on the wheel for release `n`: its weight over what is left of 100 %, so a
 * player who ships every release wins at release k with probability exactly `weight_k` %.
 * Releases after the authored ones keep the last chance.
 */
export function jackpotHazard(content: ReleaseContent, n: number): number {
  const k = Math.min(n, content.windows.length);
  const before = content.windows.slice(0, k - 1).reduce((sum, w) => sum + w.jackpotWeight, 0);
  return (content.windows[k - 1]?.jackpotWeight ?? 0) / (100 - before);
}

/** The release on offer now: the next one, once the project works and while the run lasts. */
export function nextRelease(run: ReadonlyRun, catalog: Catalog): ReleaseWindowDefinition | null {
  if (run.status !== 'playing') return null;
  if (!run.unlockedTechnologyIds.includes(catalog.releases.availableFrom)) return null;
  return releaseAt(catalog.releases, run.releases.length + 1);
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
 * Ship the next release: it needs its price built into the release project and consumes it. Draw
 * jackpot → slice → comment from `rng.release` (slices and comments repeat only once all were
 * used), record it with the cat's presence, and log it. A jackpot ends the run with the jackpot
 * ending in the same transition.
 */
export function shipRelease(run: RunState, catalog: Catalog): ShipResult {
  const window = nextRelease(run, catalog);
  if (!window) return { accepted: false, reason: 'unavailable' };
  const built = run.projects.release;
  if (!built || built.code < built.price) return { accepted: false, reason: 'unaffordable' };
  const content = catalog.releases;

  let rng = run.rng.release;
  const roll = nextFloat(rng);
  rng = roll.state;
  const jackpot = roll.value < jackpotHazard(content, window.window);
  let outcome: ReleaseRecord['outcome'] = 'jackpot';
  let commentId: string | null = null;
  if (!jackpot) {
    const usedSlices = new Set(run.releases.map((r) => r.outcome));
    const fresh = content.slices.filter((s) => !usedSlices.has(s.id));
    const slices = fresh.length > 0 ? fresh : content.slices;
    const slice = nextInt(rng, 0, slices.length - 1);
    rng = slice.state;
    outcome = slices[slice.value]?.id ?? 'three-users';
    const usedComments = new Set(run.releases.map((r) => r.commentId));
    const unused = content.comments.filter((c) => !usedComments.has(c.id));
    const comments = unused.length > 0 ? unused : content.comments;
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
      // Shipping consumes what was built into the release.
      projects: withoutProject(run.projects, 'release'),
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

/** One log line when a release first becomes available (once per release number). */
export function releaseNotices(run: RunState, catalog: Catalog): RunState {
  const release = nextRelease(run, catalog);
  if (!release) return run;
  const id = `release-open-${release.window}`;
  if (run.narrative.fired.includes(id)) return run;
  return appendLog(
    { ...run, narrative: { ...run.narrative, fired: [...run.narrative.fired, id] } },
    `🚢 ${release.description}`,
    catalog,
  );
}
