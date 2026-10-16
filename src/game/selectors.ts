import { catConditions, visibleAttention, type CatConditions } from './cat';
import type { ReadonlyPlay } from './catPlaySession';
import type { CatPresentation, Catalog, StatId, UpgradeDefinition } from './catalog';
import { upgradeLevel, upgradePrice } from './economy';
import type { PrimaryActionId, TechnologyId, UpgradeId } from './ids';
import { currentPrimaryAction, findTechnology, isUpgradeOffered } from './progression';
import type { AttentionLevel, ReadonlyRun } from './types';

/** Maximum number of current upgrade/choice cards shown in Game. */
export const MAX_OFFERS = 3;

export interface OfferViewModel {
  readonly id: UpgradeId;
  readonly title: string;
  readonly description: string;
  readonly price: number;
  readonly affordable: boolean;
}

export interface StatViewModel {
  readonly id: string;
  readonly label: string;
  readonly value: number;
}

export interface AnnouncementViewModel {
  readonly id: TechnologyId;
  readonly title: string;
  readonly description: string;
  readonly illustrationId: string;
}

export interface LogLineViewModel {
  readonly text: string;
  readonly activeMs: number;
}

export interface GameViewModel {
  readonly primaryAction: { readonly id: PrimaryActionId; readonly label: string };
  readonly stats: readonly StatViewModel[];
  readonly offers: readonly OfferViewModel[];
  readonly announcement: AnnouncementViewModel | null;
  readonly log: readonly LogLineViewModel[];
}

export interface HistoryEntryViewModel {
  readonly kind: 'technology' | 'cat' | 'event';
  readonly title: string;
  readonly activeMs: number;
}

export interface HistoryViewModel {
  readonly entries: readonly HistoryEntryViewModel[];
}

/** Progression first; a satisfied recovery rule outranks optional repeatables. */
const RECOVERY_PRIORITY = 20;

function offerPriority(run: ReadonlyRun, upgrade: UpgradeDefinition): number {
  const rule = upgrade.recovery;
  if (rule?.tokensBelow !== undefined && run.economy.tokens < rule.tokensBelow) {
    return Math.min(upgrade.priority, RECOVERY_PRIORITY);
  }
  return upgrade.priority;
}

function statValue(run: ReadonlyRun, id: StatId): number {
  switch (id) {
    case 'output':
      return Math.floor(run.economy.output);
    case 'tokens':
      return Math.floor(run.economy.tokens);
    case 'debt':
      return Math.floor(run.economy.debt);
    case 'automation':
    case 'revenue':
    case 'margin':
      return 0;
  }
}

/** At most three current statistics, chosen by the latest technology that sets them. */
function headerStats(run: ReadonlyRun, catalog: Catalog): StatViewModel[] {
  let ids: readonly StatId[] = ['output'];
  for (const id of run.unlockedTechnologyIds) {
    const stats = findTechnology(catalog, id)?.headerStats;
    if (stats) ids = stats;
  }
  return ids
    .slice(0, 3)
    .map((id) => ({ id, label: catalog.statLabels[id], value: statValue(run, id) }));
}

/** Only what the current Game view may show: current offers, never future definitions. */
export function selectGame(run: ReadonlyRun, catalog: Catalog): GameViewModel {
  const action = currentPrimaryAction(run, catalog);
  const offers = catalog.upgrades
    .map((upgrade, order) => ({ upgrade, order, priority: offerPriority(run, upgrade) }))
    .filter(({ upgrade }) => isUpgradeOffered(run, upgrade))
    .sort((a, b) => a.priority - b.priority || a.order - b.order)
    .slice(0, MAX_OFFERS)
    .map(({ upgrade }): OfferViewModel => {
      const price = upgradePrice(upgrade, upgradeLevel(run, upgrade.id));
      return {
        id: upgrade.id,
        title: upgrade.title,
        description: upgrade.description,
        price,
        affordable: run.economy.output >= price,
      };
    });
  const pendingId = run.pendingUnlockIds[0];
  const pending = pendingId === undefined ? undefined : findTechnology(catalog, pendingId);
  return {
    primaryAction: { id: action, label: catalog.primaryActionLabels[action] },
    stats: headerStats(run, catalog),
    offers,
    announcement: pending
      ? {
          id: pending.id,
          title: pending.title,
          description: pending.description,
          illustrationId: pending.illustrationId,
        }
      : null,
    log: run.log.slice(-catalog.balance.logVisibleLines),
  };
}

/** Chronological record of what actually happened in this run. */
export function selectHistory(run: ReadonlyRun, catalog: Catalog): HistoryViewModel {
  return {
    entries: run.history.map((entry): HistoryEntryViewModel => {
      switch (entry.kind) {
        case 'technology':
          return {
            kind: 'technology',
            title: findTechnology(catalog, entry.id)?.title ?? entry.id,
            activeMs: entry.activeMs,
          };
        case 'cat':
          return {
            kind: 'cat',
            title: catalog.catText.history[entry.id],
            activeMs: entry.activeMs,
          };
        case 'event':
          return {
            kind: 'event',
            title: catalog.events.find((e) => e.id === entry.textId)?.text ?? entry.textId,
            activeMs: entry.activeMs,
          };
      }
    }),
  };
}

export interface CatViewModel {
  readonly alive: boolean;
  readonly health: number;
  readonly mood: number;
  readonly fullness: number;
  readonly presentation: CatPresentation;
  readonly overfed: boolean;
  readonly sick: boolean;
  readonly conditionText: string;
  readonly overfedText: string | null;
  /** Message about the last accepted care action, while still relevant. */
  readonly careMessage: string | null;
  /** Current PLAY session (timeline data; UI derives phase/position with the shared functions). */
  readonly play: ReadonlyPlay | null;
  readonly playAttempts: number;
  /** Current foreground intrusion, if any. */
  readonly attention: { readonly level: AttentionLevel | null; readonly key: number };
}

/** Presentation priority; independent flags stay available alongside. */
export function catPresentation(conditions: CatConditions): CatPresentation {
  if (conditions.dead) return 'dead';
  if (conditions.critical) return 'critical';
  if (conditions.sick) return 'sick';
  if (conditions.hungry) return 'hungry';
  if (conditions.attentionSeeking) return 'attentionSeeking';
  if (conditions.lonely) return 'lonely';
  return 'normal';
}

/** Cat status for the header bars and Cat view. Fullness is shown only in Cat. */
export function selectCat(run: ReadonlyRun, catalog: Catalog): CatViewModel {
  const conditions = catConditions(run.cat, catalog.balance.cat);
  const presentation = catPresentation(conditions);
  const care = run.cat.lastCare;
  const careFresh =
    run.cat.alive &&
    care !== null &&
    run.activeMs - care.atActiveMs < catalog.catText.careMessageMs;
  return {
    alive: run.cat.alive,
    health: run.cat.health,
    mood: run.cat.mood,
    fullness: run.cat.fullness,
    presentation,
    overfed: conditions.overfed,
    sick: conditions.sick,
    conditionText: catalog.catText.conditions[presentation],
    overfedText: conditions.overfed && run.cat.alive ? catalog.catText.overfed : null,
    careMessage: careFresh ? catalog.catText.care[care.note] : null,
    play: run.cat.alive ? run.catPlay : null,
    attention: {
      level:
        run.status === 'playing' && run.cat.alive
          ? visibleAttention(run.attention, run.activeMs)
          : null,
      key: run.attention.count,
    },
    playAttempts: catalog.balance.catPlay.attempts,
  };
}

export interface WorldViewModel {
  readonly technologyIds: readonly TechnologyId[];
  /** The discovery currently being announced; its addition is revealed when Game shows it. */
  readonly pendingRevealId: TechnologyId | null;
  readonly cat: {
    readonly alive: boolean;
    readonly presentation: CatPresentation;
    readonly round: boolean;
  };
}

/** Discovered-world projection for the renderer: unlocked IDs and the cat's presentation facts. */
export function selectWorld(run: ReadonlyRun, catalog: Catalog): WorldViewModel {
  const conditions = catConditions(run.cat, catalog.balance.cat);
  return {
    technologyIds: run.unlockedTechnologyIds,
    pendingRevealId: run.pendingUnlockIds[0] ?? null,
    cat: {
      alive: run.cat.alive,
      presentation: catPresentation(conditions),
      round: run.cat.alive && conditions.overfed,
    },
  };
}
