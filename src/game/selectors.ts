import { catConditions, visibleAttention, type CatConditions } from './cat';
import type { ReadonlyPlay } from './catPlaySession';
import type { CatPresentation, Catalog, StatId, UpgradeDefinition } from './catalog';
import {
  automationFraction,
  coordinationEfficiency,
  deriveRates,
  economyFlows,
  offerPrice,
  qualityEfficiency,
  tokenDemandPerSecond,
  tokenPack,
} from './economy';
import type {
  ChoiceId,
  EndingId,
  PrimaryActionId,
  ReleaseWindow,
  TechnologyId,
  UpgradeId,
} from './ids';
import { isChoiceOffered } from './endings';
import { currentPrimaryAction, findTechnology, isUpgradeOffered } from './progression';
import { cardEffects } from './effectText';
import { experienceOf } from './experience';
import { creditState, type CreditState } from './money';
import { plantLook, type PlantLook } from './plant';
import { upgradeImpact } from './setup';
import { deriveSeed } from './random';
import { catAware } from './catAware';
import { jackpotHazard, nextRelease, releaseAt, releaseLabel } from './releases';
import { demoLine, demoText, nextDemo } from './demos';
import type {
  AttentionLevel,
  CareNote,
  DeepReadonly,
  DiscoveredEnding,
  ReadonlyRun,
} from './types';

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
  /** Token packs: how many tokens this purchase adds. */
  readonly tokens?: number;
  /** Progression cards: the illustration of the technology they discover. */
  readonly illustrationId?: string;
  /** What buying it does to the game, in short lines (from the real effect definitions). */
  readonly effects: readonly string[];
  /** Its effect on the economy right now (null for consumables such as token packs). */
  readonly impact: { readonly codePerSecond: number; readonly debtPerSecond: number } | null;
}

/** A decision card on the same surface as upgrades; no price, maybe a confirmation. */
export interface ChoiceOfferViewModel {
  readonly kind: 'choice';
  readonly id: ChoiceId;
  readonly title: string;
  readonly description: string;
  readonly confirm: string | null;
  /** What choosing it does to the game. */
  readonly effects: readonly string[];
}

/** The open launch window: ship a release for code; no confirmation, the wheel shows the odds. */
export interface ReleaseOfferViewModel {
  readonly kind: 'release';
  readonly id: 'release';
  readonly window: ReleaseWindow;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly price: number;
  readonly affordable: boolean;
  /** Code still missing (0 when affordable). */
  readonly shortfall: number;
  /** The true chance of the gold slice on this release (0–1). */
  readonly retireChance: number;
  readonly effects: readonly string[];
}

export type OfferViewModel = UpgradeOfferViewModel | ChoiceOfferViewModel;

/** One slice of the release wheel, in drawing order (the gold slice is last). */
export interface WheelSliceViewModel {
  readonly id: string;
  readonly label: string;
  readonly gold: boolean;
}

/** The next demo, in its own strip (null before the project works or after the end). */
export interface DemoOfferViewModel {
  readonly number: number;
  readonly title: string;
  readonly price: number;
  readonly affordable: boolean;
  readonly shortfall: number;
  /** The next demo's seed and the demos before it: the designer previews from these. */
  readonly seed: number;
  readonly steps: readonly DemoStepViewModel[];
  /** The player's design (variant 0–2, 3 = mystery), or null: the judge chooses. */
  readonly pick: number | null;
}

/** One demo of a lineage: its seed and how it was picked. */
export interface DemoStepViewModel {
  readonly seed: number;
  readonly pick: number | null;
}

/** A coded demo: what the popup shows; `steps` is its whole lineage (demos 1…number). */
export interface DemoViewModel {
  readonly number: number;
  readonly steps: readonly DemoStepViewModel[];
  readonly title: string;
  readonly group: string;
  readonly greetings: readonly string[];
  readonly scroller: readonly string[];
  readonly activeMs: number;
}

/** The wheel for a release that is already committed; the UI only animates toward it. */
export interface ReleaseWheelViewModel {
  readonly window: ReleaseWindow;
  readonly version: string;
  /** The true chance of the gold slice on this spin (0–1). */
  readonly hazard: number;
  readonly slices: readonly WheelSliceViewModel[];
  /** Index into `slices` of where the wheel lands. */
  readonly target: number;
  /** Presentation-only seed for spin turns and the landing point inside the slice. */
  readonly spinSeed: number;
  readonly result: {
    readonly jackpot: boolean;
    readonly label: string;
    readonly text: string;
    readonly comment: string | null;
  };
}

export interface EndingViewModel {
  readonly id: EndingId;
  readonly title: string;
  readonly paragraphs: readonly string[];
  /** Picture asset ID, chosen by the cat's presence when the run ended (null: no picture). */
  readonly illustrationId: string | null;
  /** Experience gained (code yield for later runs; 0 if this lesson was already learned) and
   * what the next run will have. */
  readonly experience: {
    readonly gained: number;
    readonly next: number;
    readonly repeat: boolean;
  } | null;
}

export interface StatViewModel {
  readonly id: StatId;
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
    /** A press would count right now (false: over the tap cap, it fizzles). */
    readonly ready: boolean;
  };
  readonly stats: readonly StatViewModel[];
  readonly offers: readonly OfferViewModel[];
  /** The next release, in its own strip outside the three cards (null before the project works). */
  readonly release: ReleaseOfferViewModel | null;
  /** The next demo, in its own strip next to Ship It. */
  readonly demo: DemoOfferViewModel | null;
  /** Demos coded in this run, in order (the popup and History replay them). */
  readonly demos: readonly DemoViewModel[];
  readonly announcement: AnnouncementViewModel | null;
  readonly log: readonly LogLineViewModel[];
  readonly ending: EndingViewModel | null;
  /** The most recently shipped release, for the wheel right after shipping (null: none). */
  readonly lastRelease: ReleaseWheelViewModel | null;
  /** Running on the bank's credit (null while the bank is in the black). */
  readonly credit: CreditState | null;
}

/** What a History line shows in front of its title. */
export type HistoryIconViewModel =
  | { readonly kind: 'illustration'; readonly id: string }
  | { readonly kind: 'emoji'; readonly text: string }
  | {
      readonly kind: 'symbol';
      readonly id:
        'cat-died' | 'cat-left' | 'achievement' | 'ending' | 'release' | 'jackpot' | 'demo';
    };

export interface HistoryEntryViewModel {
  readonly kind: 'technology' | 'cat' | 'event' | 'achievement' | 'ending' | 'release' | 'demo';
  /** A demo entry: which demo to replay. */
  readonly demo?: number;
  readonly title: string;
  readonly activeMs: number;
  readonly icon: HistoryIconViewModel;
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

/**
 * The optional card that relieves what binds right now: first among the optional cards, right
 * after progression, recovery and decisions — it never hides an ending choice.
 */
const RELEVANT_PRIORITY = 31;

const CAPACITY_CARDS = ['additional-agent', 'compute-slot', 'review-capacity'] as const;
/** A capacity card "helps" when its extra code pays its price back within this long. */
const HELPS_WITHIN_SECONDS = 300;

interface CardAdvice {
  /** The optional card that relieves what binds now (shown first among optional cards). */
  readonly relevant: string | null;
  /** Capacity cards whose extra code would pay back soon (the others are not offered). */
  readonly helping: ReadonlySet<string>;
}

/** Which optional card is relevant now, from the economy's own flows (one step ahead). */
type ImpactOf = (upgrade: UpgradeDefinition) => ReturnType<typeof upgradeImpact>;

function cardAdvice(run: ReadonlyRun, catalog: Catalog, impactOf: ImpactOf): CardAdvice {
  const rates = deriveRates(run, catalog);
  const helping = new Set<string>();
  if (rates.agents === 0) return { relevant: null, helping };
  const offered = catalog.upgrades.filter(
    (u) => (CAPACITY_CARDS as readonly string[]).includes(u.id) && isUpgradeOffered(run, u),
  );
  // The capacity card that adds the most code per code spent right now…
  let best: { id: string; value: number } | null = null;
  for (const upgrade of offered) {
    const gain = impactOf(upgrade)?.codePerSecond ?? 0;
    const value = gain / Math.max(1, offerPrice(run, upgrade, catalog));
    if (value * HELPS_WITHIN_SECONDS < 1) continue;
    helping.add(upgrade.id);
    if (!best || value > best.value) best = { id: upgrade.id, value };
  }
  return { relevant: relevantCard(run, catalog, rates, offered, best?.id ?? null), helping };
}

function relevantCard(
  run: ReadonlyRun,
  catalog: Catalog,
  rates: ReturnType<typeof deriveRates>,
  offered: readonly UpgradeDefinition[],
  best: string | null,
): string | null {
  const demand = tokenDemandPerSecond(rates);
  if (demand > 0 && run.economy.tokens < demand * 30) return 'token-supply';
  if (run.economy.debt > 20 && offered.some((u) => u.id === 'review-capacity')) {
    return 'review-capacity';
  }
  if (best) return best;
  // …or, when none helps alone (agents need compute and a manager), the scarcest of the three —
  // only while more agents can be hired (compute and managers beyond the agents do nothing).
  const flows = economyFlows(run.economy, rates, 0.1, catalog.balance);
  if (flows.funded < flows.demand - 1e-9) return null;
  if (!offered.some((u) => u.id === 'additional-agent')) return null;
  if (rates.agents <= Math.min(rates.compute, rates.managed)) return 'additional-agent';
  if (rates.compute <= rates.managed) return 'compute-slot';
  return 'review-capacity';
}

function offerPriority(
  run: ReadonlyRun,
  upgrade: UpgradeDefinition,
  relevant: string | null,
): number {
  if (upgrade.id === relevant) return Math.min(upgrade.priority, RELEVANT_PRIORITY);
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
    case 'quality':
      return Math.round(qualityEfficiency(run.economy.debt) * 100);
    case 'team': {
      const rates = deriveRates(run, catalog);
      return Math.round(
        coordinationEfficiency(rates.managed, Math.min(rates.agents, rates.compute)) * 100,
      );
    }
  }
}

/**
 * The current statistics, chosen by the latest technology that sets them: three at most early
 * on; the late company piles up to six numbers on the player (two rows).
 */
function headerStats(run: ReadonlyRun, catalog: Catalog): StatViewModel[] {
  let ids: readonly StatId[] = ['output'];
  for (const id of run.unlockedTechnologyIds) {
    const stats = findTechnology(catalog, id)?.headerStats;
    if (stats) ids = stats;
  }
  // The hidden couplings made visible (E2): QUALITY and TEAM appear while they hurt (< 95 %),
  // taking the progress meter's (automation) slot first.
  const pressure: StatId[] = [];
  if (run.economy.debt > 0 && statValue(run, 'quality', catalog) < 95) pressure.push('quality');
  if (run.unlockedTechnologyIds.length > 0 && statValue(run, 'team', catalog) < 95) {
    pressure.push('team');
  }
  // Early panels keep three numbers: QUALITY and TEAM show only where a slot is free (DEBT already
  // tells the quality story); Setup's "Limited by" names the rest.
  const cap = ids.length > 3 ? 6 : 3;
  let shown = [...ids];
  for (const id of pressure) {
    const automation = shown.indexOf('automation');
    if (automation >= 0) shown[automation] = id;
    else if (shown.length < cap) shown.push(id);
    else if (cap === 6) shown = [...shown.slice(0, 5), id];
  }
  return shown
    .slice(0, 6)
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
export function selectGame(
  run: ReadonlyRun,
  catalog: Catalog,
  discovered: readonly DeepReadonly<DiscoveredEnding>[] = [],
): GameViewModel {
  // One impact per card per call (the advice and the card both read it).
  const impacts = new Map<string, ReturnType<typeof upgradeImpact>>();
  const impactOf: ImpactOf = (upgrade) => {
    if (!impacts.has(upgrade.id)) impacts.set(upgrade.id, upgradeImpact(run, upgrade, catalog));
    return impacts.get(upgrade.id) ?? null;
  };
  const { relevant, helping } = cardAdvice(run, catalog, impactOf);
  const action = currentPrimaryAction(run, catalog);
  const upgradeCards = catalog.upgrades
    // Capacity is offered only when it helps now or is what to buy next (no idle traps).
    .filter(
      (upgrade) =>
        isUpgradeOffered(run, upgrade) &&
        (!upgrade.priceRule || helping.has(upgrade.id) || upgrade.id === relevant),
    )
    .map((upgrade, order) => {
      const price = offerPrice(run, upgrade, catalog);
      const card: UpgradeOfferViewModel = {
        kind: 'upgrade',
        id: upgrade.id,
        title: upgrade.title,
        description: upgrade.description,
        price,
        currency: upgrade.currency,
        affordable:
          (upgrade.currency === 'revenue' ? run.economy.revenue : run.economy.output) >= price,
        effects: cardEffects(upgrade, catalog),
        impact: impactOf(upgrade),
        ...(upgrade.pack === 'tokens' ? { tokens: tokenPack(run, catalog).tokens } : {}),
        ...(upgrade.discovers
          ? {
              illustrationId:
                findTechnology(catalog, upgrade.discovers)?.illustrationId ?? upgrade.discovers,
            }
          : {}),
      };
      return { card, order, priority: offerPriority(run, upgrade, relevant) };
    });
  const choiceCards = catalog.choices
    .filter((choice) => isChoiceOffered(run, choice))
    .map((choice, order) => {
      const card: ChoiceOfferViewModel = {
        kind: 'choice',
        id: choice.id,
        title: choice.title,
        description:
          typeof choice.description === 'string' ? choice.description : choice.description(run),
        confirm: choice.confirm ?? null,
        effects: choice.ends
          ? ['ends the run']
          : choice.overhead
            ? ['adds operating costs above revenue', 'the bank lends until the credit runs out']
            : choice.cancels
              ? ['stops the extra costs']
              : choice.id === 'keep-manual'
                ? ['no more automation offers', 'action → WRITE CODE']
                : [],
      };
      return { card, order: 1000 + order, priority: CHOICE_PRIORITY };
    });
  // While a progression card is showing, at most two decision cards share the surface so the
  // route keeps room for the next discovery; at the end decisions may fill all three.
  const progressionShown = upgradeCards.some(
    ({ card }) => findUpgradeDefinition(catalog, card.id)?.discovers,
  );
  const decisions = choiceCards.slice(0, progressionShown ? 2 : MAX_OFFERS);
  const offers = [...upgradeCards, ...decisions]
    .sort((a, b) => a.priority - b.priority || a.order - b.order)
    .slice(0, MAX_OFFERS)
    .map(({ card }) => card);
  // Ship It has its own strip outside the three cards (economy redesign D2): always the next
  // release, once the project works.
  const window = nextRelease(run, catalog);
  const release: ReleaseOfferViewModel | null = window
    ? {
        kind: 'release',
        id: 'release',
        window: window.window,
        version: window.version,
        title: window.title,
        description: window.description,
        price: window.price,
        affordable: run.economy.output >= window.price,
        shortfall: Math.max(0, window.price - run.economy.output),
        retireChance: jackpotHazard(catalog.releases, window.window),
        effects: [
          'spends ALL your code',
          `${Number((jackpotHazard(catalog.releases, window.window) * 100).toFixed(2))}% chance to retire`,
        ],
      }
    : null;
  const demoOffer = nextDemo(run, catalog);
  const demo: DemoOfferViewModel | null = demoOffer
    ? {
        number: demoOffer.number,
        title: catalog.demos.title,
        price: demoOffer.price,
        affordable: run.economy.output >= demoOffer.price,
        shortfall: Math.max(0, demoOffer.price - run.economy.output),
        seed: demoOffer.seed,
        steps: run.demos.map((d) => ({ seed: d.seed, pick: d.pick })),
        pick: run.demoPick,
      }
    : null;
  const pendingId = run.pendingUnlockIds[0];
  const pending = pendingId === undefined ? undefined : findTechnology(catalog, pendingId);
  return {
    primaryAction: {
      id: action,
      label: catalog.primaryActionLabels[action],
      gain: primaryGain(run, catalog, action),
      ready: run.economy.actionCharges >= 1,
    },
    stats: headerStats(run, catalog),
    offers,
    release,
    demo,
    demos: selectDemos(run, catalog),
    announcement: pending
      ? {
          id: pending.id,
          title: pending.title,
          description: catAware(pending.description, run.cat.alive),
          illustrationId: pending.illustrationId,
        }
      : null,
    log: run.log.slice(-catalog.balance.logVisibleLines),
    ending: selectEnding(run, catalog, discovered),
    lastRelease: selectRelease(run, catalog, run.releases.length - 1),
    credit: creditState(run, catalog),
  };
}

/** Every demo of the run with its texts and lineage. */
export function selectDemos(run: ReadonlyRun, catalog: Catalog): readonly DemoViewModel[] {
  const steps = run.demos.map((d) => ({ seed: d.seed, pick: d.pick }));
  return run.demos.map((record, i) => ({
    number: record.number,
    steps: steps.slice(0, i + 1),
    ...demoText(record, catalog),
    activeMs: record.activeMs,
  }));
}

/** A lesson ending: new to the profile, or already learned in an earlier run. */
function endingLesson(
  run: ReadonlyRun,
  amount: number,
  id: EndingId,
  discovered: readonly DeepReadonly<DiscoveredEnding>[],
  catalog: Catalog,
): { gained: number; next: number; repeat: boolean } {
  const earlier = discovered.some((e) => e.id === id && e.runId !== run.id);
  const all = discovered.some((e) => e.id === id) ? discovered : [...discovered, { id }];
  return { gained: earlier ? 0 : amount, next: experienceOf(all, catalog), repeat: earlier };
}

/** The ending panel: stored ending ID and the fate captured when it happened. */
function selectEnding(
  run: ReadonlyRun,
  catalog: Catalog,
  discovered: readonly DeepReadonly<DiscoveredEnding>[],
): EndingViewModel | null {
  const record = run.ending;
  if (!record) return null;
  const definition = catalog.endings.find((e) => e.id === record.id);
  if (!definition) {
    return {
      id: record.id,
      title: record.id,
      paragraphs: [],
      illustrationId: null,
      experience: null,
    };
  }
  const picture = definition.illustrationId;
  return {
    id: record.id,
    title: definition.title,
    illustrationId: picture ? `ending-${picture}${record.catAlive ? '' : '-nocat'}` : null,
    experience: definition.experience
      ? endingLesson(run, definition.experience, record.id, discovered, catalog)
      : null,
    paragraphs: record.catAlive
      ? definition.text.alive
      : record.catLeft
        ? definition.text.stray
        : definition.text.dead,
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
            icon: {
              kind: 'illustration',
              id: findTechnology(catalog, entry.id)?.illustrationId ?? entry.id,
            },
          };
        case 'cat':
          return {
            kind: 'cat',
            title: catalog.catText.history[entry.id],
            activeMs: entry.activeMs,
            icon: { kind: 'symbol', id: entry.id },
          };
        case 'ending':
          return {
            kind: 'ending',
            title: catalog.endings.find((e) => e.id === entry.id)?.title ?? entry.id,
            activeMs: entry.activeMs,
            icon: { kind: 'symbol', id: 'ending' },
          };
        case 'achievement':
          return {
            kind: 'achievement',
            title: catalog.achievements.find((a) => a.id === entry.id)?.title ?? entry.id,
            activeMs: entry.activeMs,
            icon: { kind: 'symbol', id: 'achievement' },
          };
        case 'event': {
          const event = catalog.events.find((e) => e.id === entry.textId);
          return {
            kind: 'event',
            title: event ? catAware(event.text, run.cat.alive) : entry.textId,
            activeMs: entry.activeMs,
            icon: { kind: 'emoji', text: event?.emoji ?? '•' },
          };
        }
        case 'release': {
          const record = run.releases.find((r) => r.window === entry.window);
          const window = releaseAt(catalog.releases, entry.window);
          const label = record ? releaseLabel(record, catalog) : entry.outcome;
          return {
            kind: 'release',
            title: catalog.releases.shippedText
              .replace('{version}', window.version)
              .replace('{label}', label),
            activeMs: entry.activeMs,
            icon: { kind: 'symbol', id: entry.outcome === 'jackpot' ? 'jackpot' : 'release' },
          };
        }
        case 'demo': {
          const record = run.demos.find((d) => d.number === entry.number);
          return {
            kind: 'demo',
            title: record ? demoLine(record, catalog) : `Demo #${entry.number}`,
            activeMs: entry.activeMs,
            icon: { kind: 'symbol', id: 'demo' },
            ...(record ? { demo: record.number } : {}),
          };
        }
      }
    }),
  };
}

export interface CatViewModel {
  readonly alive: boolean;
  /** Where the cat is: still here, dead (memorial), or gone as a stray (missing poster). */
  readonly fate: 'alive' | 'dead' | 'stray';
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
  /** Which care note that message belongs to (e.g. to label a tap on the bowl). */
  readonly careNote: CareNote | null;
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
    fate: run.cat.alive ? 'alive' : run.cat.leftAtActiveMs !== null ? 'stray' : 'dead',
    health: run.cat.health,
    mood: run.cat.mood,
    fullness: run.cat.fullness,
    presentation,
    overfed: conditions.overfed,
    sick: conditions.sick,
    conditionText: catalog.catText.conditions[presentation],
    overfedText: conditions.overfed && run.cat.alive ? catalog.catText.overfed : null,
    careMessage: careFresh ? catalog.catText.care[care.note] : null,
    careNote: careFresh ? care.note : null,
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
  /** Shipped releases (each hangs framed on the room wall). */
  readonly releases: number;
  /** Bought compute slots (each stacks as a server unit in the room). */
  readonly computeSlots: number;
  /** How the corner plant looks (it can be watered, and drowned, and forgotten). */
  readonly plant: PlantLook;
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
    releases: run.releases.length,
    computeSlots: run.upgradeLevels['compute-slot'] ?? 0,
    plant: plantLook(run, catalog),
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

/** The wheel for the `index`-th shipped release (null if there is none). */
export function selectRelease(
  run: ReadonlyRun,
  catalog: Catalog,
  index: number,
): ReleaseWheelViewModel | null {
  const record = run.releases[index];
  const content = catalog.releases;
  if (!record) return null;
  const window = releaseAt(content, record.window);
  const slices: WheelSliceViewModel[] = [
    ...content.slices.map((s) => ({
      id: s.id,
      label: catAware(s.label, record.catAlive),
      gold: false,
    })),
    { id: 'jackpot', label: content.jackpotLabel, gold: true },
  ];
  const slice = content.slices.find((s) => s.id === record.outcome);
  return {
    window: record.window,
    version: window.version,
    hazard: jackpotHazard(content, record.window),
    slices,
    target: slices.findIndex((s) => s.id === record.outcome),
    spinSeed: deriveSeed(run.visualSeed, `release-${record.window}`),
    result: {
      jackpot: record.outcome === 'jackpot',
      label: releaseLabel(record, catalog),
      text: slice ? catAware(slice.text, record.catAlive) : '',
      comment: content.comments.find((c) => c.id === record.commentId)?.text ?? null,
    },
  };
}
