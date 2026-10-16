import { catConditions, type CatConditions } from './cat';
import type { CatPresentation, Catalog } from './catalog';
import { upgradeLevel, upgradePrice } from './economy';
import type { PrimaryActionId, TechnologyId, UpgradeId } from './ids';
import { currentPrimaryAction, findTechnology, isUpgradeOffered } from './progression';
import type { ReadonlyRun } from './types';

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

/** Only what the current Game view may show: current offers, never future definitions. */
export function selectGame(run: ReadonlyRun, catalog: Catalog): GameViewModel {
  const action = currentPrimaryAction(run, catalog);
  const offers = catalog.upgrades
    .map((upgrade, order) => ({ upgrade, order }))
    .filter(({ upgrade }) => isUpgradeOffered(run, upgrade))
    .sort((a, b) => a.upgrade.priority - b.upgrade.priority || a.order - b.order)
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
    stats: [{ id: 'output', label: 'Code', value: Math.floor(run.economy.output) }],
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
          return { kind: 'event', title: entry.textId, activeMs: entry.activeMs };
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
  };
}

export interface WorldViewModel {
  readonly technologyIds: readonly TechnologyId[];
  readonly catAlive: boolean;
}

/** Discovered-world projection for the renderer: unlocked IDs and the cat's lifecycle fact. */
export function selectWorld(run: ReadonlyRun): WorldViewModel {
  return { technologyIds: run.unlockedTechnologyIds, catAlive: run.cat.alive };
}
