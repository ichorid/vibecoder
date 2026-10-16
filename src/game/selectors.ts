import { catConditions, visibleAttention, type CatConditions } from './cat';
import type { ReadonlyPlay } from './catPlaySession';
import type { CatPresentation, Catalog, StatId, UpgradeDefinition } from './catalog';
import { automationFraction, deriveRates, upgradeLevel, upgradePrice } from './economy';
import type { ChoiceId, EndingId, PrimaryActionId, TechnologyId, UpgradeId } from './ids';
import { isChoiceOffered } from './endings';
import { currentPrimaryAction, findTechnology, isUpgradeOffered } from './progression';
import type { AttentionLevel, DeepReadonly, DiscoveredEnding, ReadonlyRun } from './types';

/** Maximum number of current upgrade/choice cards shown in Game. */
export const MAX_OFFERS = 3;

export interface UpgradeOfferViewModel {
  readonly kind: 'upgrade';
  readonly id: UpgradeId;
  readonly title: string;
  readonly description: string;
  readonly price: number;
  readonly currency: 'output' | 'revenue';
  readonly affordable: boolean;
}

/** A decision card on the same surface as upgrades; no price, maybe a confirmation. */
export interface ChoiceOfferViewModel {
  readonly kind: 'choice';
  readonly id: ChoiceId;
  readonly title: string;
  readonly description: string;
  readonly confirm: string | null;
}

export type OfferViewModel = UpgradeOfferViewModel | ChoiceOfferViewModel;

export interface EndingViewModel {
  readonly id: EndingId;
  readonly title: string;
  readonly paragraphs: readonly string[];
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

/** What one press of the primary action yields right now (null: it would add nothing). */
export interface PrimaryGainViewModel {
  readonly amount: number;
  readonly unit: 'code' | 'managed' | 'debt' | 'efficiency';
}

export interface GameViewModel {
  readonly primaryAction: {
    readonly id: PrimaryActionId;
    readonly label: string;
    readonly gain: PrimaryGainViewModel | null;
  };
  readonly stats: readonly StatViewModel[];
  readonly offers: readonly OfferViewModel[];
  readonly announcement: AnnouncementViewModel | null;
  readonly log: readonly LogLineViewModel[];
  readonly ending: EndingViewModel | null;
}

export interface HistoryEntryViewModel {
  readonly kind: 'technology' | 'cat' | 'event' | 'achievement' | 'ending';
  readonly title: string;
  readonly activeMs: number;
}

export interface DiscoveredEndingViewModel {
  readonly id: EndingId;
  readonly title: string;
  readonly activeMs: number;
  readonly order: number;
}

export interface HistoryViewModel {
  readonly entries: readonly HistoryEntryViewModel[];
  /** Endings discovered in this or earlier runs (profile), in discovery order. */
  readonly endings: readonly DiscoveredEndingViewModel[];
}

function findUpgradeDefinition(catalog: Catalog, id: string): UpgradeDefinition | undefined {
  return catalog.upgrades.find((upgrade) => upgrade.id === id);
}

/** Progression first; a satisfied recovery rule outranks optional repeatables. */
const RECOVERY_PRIORITY = 20;
/** Decision cards come after progression/recovery and before optional repeatables. */
const CHOICE_PRIORITY = 30;

function offerPriority(run: ReadonlyRun, upgrade: UpgradeDefinition): number {
  const rule = upgrade.recovery;
  if (rule?.tokensBelow !== undefined && run.economy.tokens < rule.tokensBelow) {
    return Math.min(upgrade.priority, RECOVERY_PRIORITY);
  }
  return upgrade.priority;
}

function statValue(run: ReadonlyRun, id: StatId, catalog: Catalog): number {
  switch (id) {
    case 'output':
      return Math.floor(run.economy.output);
    case 'tokens':
      return Math.floor(run.economy.tokens);
    case 'debt':
      return Math.floor(run.economy.debt);
    case 'automation':
      return Math.round(automationFraction(run, catalog) * 100);
    case 'revenue':
      return Math.floor(run.economy.revenue);
    case 'margin':
      return Math.round(run.economy.revenuePerSecond - run.economy.costPerSecond);
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
    .map((id) => ({ id, label: catalog.statLabels[id], value: statValue(run, id, catalog) }));
}

/** Mirrors `primaryAction` in commands.ts: the same rates, caps and charge budget. */
function primaryGain(
  run: ReadonlyRun,
  catalog: Catalog,
  action: PrimaryActionId,
): PrimaryGainViewModel | null {
  if (run.economy.actionCharges < 1) return null;
  const coordination = catalog.balance.coordination;
  switch (action) {
    case 'writeCode':
    case 'prompt':
      return { amount: deriveRates(run, catalog).manualOutput, unit: 'code' };
    case 'delegate':
      return run.economy.delegation < coordination.delegationCap
        ? { amount: 1, unit: 'managed' }
        : null;
    case 'supervise': {
      const removed = Math.min(run.economy.debt, coordination.supervisePerPress);
      return removed > 0 ? { amount: removed, unit: 'debt' } : null;
    }
    case 'optimize':
      return run.economy.optimization < catalog.balance.optimizeCap
        ? { amount: catalog.balance.optimizeStep, unit: 'efficiency' }
        : null;
    case 'observe':
      return null;
  }
}

/** Only what the current Game view may show: current offers, never future definitions. */
export function selectGame(run: ReadonlyRun, catalog: Catalog): GameViewModel {
  const action = currentPrimaryAction(run, catalog);
  const upgradeCards = catalog.upgrades
    .filter((upgrade) => isUpgradeOffered(run, upgrade))
    .map((upgrade, order) => {
      const price = upgradePrice(upgrade, upgradeLevel(run, upgrade.id));
      const card: UpgradeOfferViewModel = {
        kind: 'upgrade',
        id: upgrade.id,
        title: upgrade.title,
        description: upgrade.description,
        price,
        currency: upgrade.currency,
        affordable:
          (upgrade.currency === 'revenue' ? run.economy.revenue : run.economy.output) >= price,
      };
      return { card, order, priority: offerPriority(run, upgrade) };
    });
  const choiceCards = catalog.choices
    .filter((choice) => isChoiceOffered(run, choice))
    .map((choice, order) => {
      const card: ChoiceOfferViewModel = {
        kind: 'choice',
        id: choice.id,
        title: choice.title,
        description: choice.description,
        confirm: choice.confirm ?? null,
      };
      return { card, order: 1000 + order, priority: CHOICE_PRIORITY };
    });
  // While a progression card is showing, at most two decision cards share the surface so the
  // route keeps room for the next discovery; at the end decisions may fill all three.
  const progressionShown = upgradeCards.some(
    ({ card }) => findUpgradeDefinition(catalog, card.id)?.discovers,
  );
  const offers = [...upgradeCards, ...choiceCards.slice(0, progressionShown ? 2 : MAX_OFFERS)]
    .sort((a, b) => a.priority - b.priority || a.order - b.order)
    .slice(0, MAX_OFFERS)
    .map(({ card }) => card);
  const pendingId = run.pendingUnlockIds[0];
  const pending = pendingId === undefined ? undefined : findTechnology(catalog, pendingId);
  return {
    primaryAction: {
      id: action,
      label: catalog.primaryActionLabels[action],
      gain: primaryGain(run, catalog, action),
    },
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
    ending: selectEnding(run, catalog),
  };
}

/** The ending panel: stored ending ID and the fate captured when it happened. */
function selectEnding(run: ReadonlyRun, catalog: Catalog): EndingViewModel | null {
  const record = run.ending;
  if (!record) return null;
  const definition = catalog.endings.find((e) => e.id === record.id);
  if (!definition) return { id: record.id, title: record.id, paragraphs: [] };
  return {
    id: record.id,
    title: definition.title,
    paragraphs: record.catAlive ? definition.text.alive : definition.text.dead,
  };
}

/** Chronological record of what actually happened in this run. */
export function selectHistory(
  run: ReadonlyRun,
  catalog: Catalog,
  discovered: readonly DeepReadonly<DiscoveredEnding>[] = [],
): HistoryViewModel {
  return {
    endings: [...discovered]
      .sort((a, b) => a.order - b.order)
      .map((ending) => ({
        id: ending.id,
        title: catalog.endings.find((e) => e.id === ending.id)?.title ?? ending.id,
        activeMs: ending.activeMs,
        order: ending.order,
      })),
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
        case 'ending':
          return {
            kind: 'ending',
            title: catalog.endings.find((e) => e.id === entry.id)?.title ?? entry.id,
            activeMs: entry.activeMs,
          };
        case 'achievement':
          return {
            kind: 'achievement',
            title: catalog.achievements.find((a) => a.id === entry.id)?.title ?? entry.id,
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

/** What the music binding may know: committed progress only — never the cat's state. */
export interface MusicProjection {
  readonly technologyIds: readonly TechnologyId[];
  readonly ended: boolean;
  readonly runId: string;
}

export function selectMusicProjection(run: ReadonlyRun): MusicProjection {
  return {
    technologyIds: [...run.unlockedTechnologyIds],
    ended: run.ending !== null,
    runId: run.id,
  };
}
