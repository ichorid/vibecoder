import { catConditions, visibleAttention, type CatConditions } from './cat';
import type { ReadonlyPlay } from './catPlaySession';
import type { CatPresentation, Catalog, StatId, UpgradeDefinition } from './catalog';
import { cardAdvice, type ImpactOf } from './advice';
import {
  automationFraction,
  coordinationEfficiency,
  deriveRates,
  offerPrice,
  qualityEfficiency,
  tokenPack,
} from './economy';
import { moneyShown } from './gigs';
import { projectCode } from './projects';
import {
  projectView,
  selectJob,
  selectMoney,
  selectNotice,
  selectRentWheel,
  type JobViewModel,
  type MoneyStripViewModel,
  type NoticeViewModel,
  type ProjectViewModel,
  type RentWheelViewModel,
} from './projectViews';
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
  MilestoneId,
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
  /** Code-priced cards are projects (tap to build); money-priced cards are bought at once. */
  readonly currency: 'output' | 'money';
  /** Money cards: the money is there. Project cards: always true (any project can be built). */
  readonly affordable: boolean;
  /** Code-priced cards: progress, pace and badge (null for money cards). */
  readonly project: ProjectViewModel | null;
  /** The system's own project: shown, never selectable. */
  readonly internal: boolean;
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
  /** Built and waiting for SHIP (the project works). */
  readonly affordable: boolean;
  /** Code still missing (0 when ready). */
  readonly shortfall: number;
  readonly project: ProjectViewModel;
  /** SHIP exists (the project works); before that the strip is just "the project". */
  readonly shippable: boolean;
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
  /** Built and waiting to run. */
  readonly affordable: boolean;
  readonly shortfall: number;
  readonly project: ProjectViewModel;
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
  /** The live-frugal lesson: rent in later runs × `factor` (repeat: learned before). */
  readonly frugal: { readonly factor: number; readonly repeat: boolean } | null;
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
  /** Money, rent and gigs (null until the first gig). */
  readonly money: MoneyStripViewModel | null;
  /** The enterprise job: an offer or the current job (null otherwise). */
  readonly job: JobViewModel | null;
  /** The next landlord wheel to watch (null: none pending). */
  readonly rentWheel: RentWheelViewModel | null;
  /** A market update or milestone panel waiting to be shown. */
  readonly notice: NoticeViewModel | null;
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
  readonly kind:
    | 'technology'
    | 'cat'
    | 'event'
    | 'achievement'
    | 'ending'
    | 'release'
    | 'demo'
    | 'market'
    | 'job'
    | 'milestone'
    | 'money';
  /** A demo entry: which demo to replay. */
  readonly demo?: number;
  /** A milestone entry: its panel can be reopened (VIEW). */
  readonly milestone?: {
    readonly id: MilestoneId;
    readonly title: string;
    readonly text: string;
    readonly illustrationId: string;
  };
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
    case 'code':
      return Math.round(run.economy.codeRate);
    case 'tokens':
      return Math.floor(run.economy.tokens);
    case 'debt':
      return Math.floor(run.economy.debt);
    case 'automation':
      return Math.round(automationFraction(run, catalog) * 100);
    case 'money':
      return Math.floor(run.economy.money);
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
  let ids: readonly StatId[] = ['code'];
  for (const id of run.unlockedTechnologyIds) {
    const stats = findTechnology(catalog, id)?.headerStats;
    if (stats) ids = stats;
  }
  // Money shows from the first gig, right after the code rate.
  if (moneyShown(run) && !ids.includes('money')) {
    ids = [ids[0] ?? 'code', 'money', ...ids.slice(1)];
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
  const inSlot = new Set(run.slots.map((s) => s.target));
  const upgradeCards = catalog.upgrades
    // Capacity is offered only when it helps now or is what to buy next (no idle traps); a
    // started build always stays on the surface. The system's own projects show while running.
    .filter((upgrade) =>
      upgrade.internal
        ? inSlot.has(upgrade.id)
        : isUpgradeOffered(run, upgrade) &&
          (!upgrade.priceRule ||
            helping.has(upgrade.id) ||
            upgrade.id === relevant ||
            projectCode(run, upgrade.id) > 0 ||
            inSlot.has(upgrade.id)),
    )
    .map((upgrade, order) => {
      const project = upgrade.currency === 'output' ? projectView(run, upgrade.id, catalog) : null;
      const price = project?.price ?? offerPrice(run, upgrade, catalog);
      const card: UpgradeOfferViewModel = {
        kind: 'upgrade',
        id: upgrade.id,
        title: upgrade.title,
        description: upgrade.description,
        price,
        currency: upgrade.currency,
        affordable: project ? true : run.economy.money >= price,
        project,
        internal: upgrade.internal === true,
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
      // A build in progress (or in a slot) outranks unstarted optional cards.
      const started = project !== null && (project.code > 0 || project.badge !== null);
      const priority = offerPriority(run, upgrade, relevant);
      return { card, order, priority: started ? Math.min(priority, RELEVANT_PRIORITY) : priority };
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
  // Ship It has its own strip outside the three cards (economy redesign D2): the original
  // project, built from the start; SHIP exists once the project works.
  const shippable = nextRelease(run, catalog);
  const window =
    shippable ??
    (catalog.releases.windows.length > 0
      ? releaseAt(catalog.releases, run.releases.length + 1)
      : null);
  const releaseProject = projectView(run, 'release', catalog);
  const release: ReleaseOfferViewModel | null =
    run.status === 'playing' && window
      ? {
          kind: 'release',
          id: 'release',
          window: window.window,
          version: window.version,
          title: shippable ? window.title : 'The project',
          description: window.description,
          price: releaseProject.price ?? window.price,
          affordable: shippable !== null && releaseProject.ready,
          shortfall: Math.max(0, (releaseProject.price ?? window.price) - releaseProject.code),
          project: releaseProject,
          shippable: shippable !== null,
          retireChance: jackpotHazard(catalog.releases, window.window),
          effects: [
            `${Number((jackpotHazard(catalog.releases, window.window) * 100).toFixed(2))}% chance to retire`,
          ],
        }
      : null;
  const demoOffer = nextDemo(run, catalog);
  const demoProject = demoOffer ? projectView(run, 'demo', catalog) : null;
  const demo: DemoOfferViewModel | null =
    demoOffer && demoProject
      ? {
          number: demoOffer.number,
          title: catalog.demos.title,
          price: demoProject.price ?? demoOffer.price,
          affordable: demoProject.ready,
          shortfall: Math.max(0, (demoProject.price ?? demoOffer.price) - demoProject.code),
          project: demoProject,
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
    money: selectMoney(run, catalog),
    job: selectJob(run, catalog),
    rentWheel: selectRentWheel(run, catalog),
    notice: selectNotice(run, catalog),
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
      frugal: null,
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
    frugal: definition.frugal
      ? {
          factor: definition.frugal,
          repeat: discovered.some((e) => e.id === record.id && e.runId !== run.id),
        }
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
        case 'market':
          return {
            kind: 'market',
            title: catalog.money.eras[entry.era]?.text ?? 'Market update',
            activeMs: entry.activeMs,
            icon: { kind: 'emoji', text: '📉' },
          };
        case 'job':
          return {
            kind: 'job',
            title:
              entry.event === 'hired'
                ? 'Hired at Enterprise Solutions Inc.'
                : 'Fired from Enterprise Solutions Inc.',
            activeMs: entry.activeMs,
            icon: { kind: 'emoji', text: '💼' },
          };
        case 'milestone':
          return {
            kind: 'milestone',
            title: catalog.money.contract.title,
            activeMs: entry.activeMs,
            icon: { kind: 'illustration', id: catalog.money.contract.illustrationId },
            milestone: { id: entry.id, ...catalog.money.contract },
          };
        case 'money':
          return {
            kind: 'money',
            title:
              entry.id === 'moved-out'
                ? "Moved out of your parents' place"
                : 'The company pays your rent',
            activeMs: entry.activeMs,
            icon: { kind: 'emoji', text: entry.id === 'moved-out' ? '🏠' : '🏢' },
          };
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
  /** Construction sites: builds in progress (docs/feature_projects.md §7.2). */
  readonly sites: readonly WorldSiteViewModel[];
  /** The rent notice on the room's door: none, a bill, or a red one after a missed month. */
  readonly rentNotice: 'none' | 'notice' | 'overdue';
}

/** A build shown in the world as scaffolding. */
export interface WorldSiteViewModel {
  /** A technology's addition, the next release frame on the wall, or the system's own project. */
  readonly kind: 'addition' | 'frame' | 'internal';
  /** The world addition ID (`addition`), the frame number (`frame`), or the project ID. */
  readonly id: string;
  /** 0–1. */
  readonly progress: number;
  /** In a slot right now (its crane moves). */
  readonly active: boolean;
  /** Drifting at reduced speed (its crane idles). */
  readonly half: boolean;
  /** Built for a while: the camera makes room for it (never on quick switching). */
  readonly framed: boolean;
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
    sites: worldSites(run, catalog),
    rentNotice:
      !run.rent.movedOut || run.unlockedTechnologyIds.includes('product-management')
        ? 'none'
        : run.rent.missedStreak > 0
          ? 'overdue'
          : 'notice',
  };
}

/** The camera makes room for a site only after it has been built this long (no bouncing). */
const SITE_FRAMING_MS = 2000;

function worldSites(run: ReadonlyRun, catalog: Catalog): WorldSiteViewModel[] {
  if (run.status !== 'playing') return [];
  const employed = run.job.employed !== null;
  const sites: WorldSiteViewModel[] = [];
  const keys = new Set<string>([
    ...run.slots.map((s) => s.target as string),
    ...Object.keys(run.projects),
  ]);
  for (const key of keys) {
    const slot = run.slots.find((s) => s.target === key);
    const project = projectView(run, key as never, catalog);
    const active = slot !== undefined && !employed;
    const half = slot?.by === 'fallback' && project.badge === 'auto-half';
    const framed = active && run.activeMs - (slot?.sinceMs ?? run.activeMs) >= SITE_FRAMING_MS;
    if (project.progress <= 0 && !active) continue;
    const site = { progress: project.progress, active, half, framed };
    if (key === 'release') {
      sites.push({ ...site, kind: 'frame', id: String(run.releases.length + 1), framed: false });
      continue;
    }
    const upgrade = findUpgradeDefinition(catalog, key);
    if (upgrade?.internal) {
      sites.push({ ...site, kind: 'internal', id: key, framed: false });
      continue;
    }
    const technology = upgrade?.discovers ? findTechnology(catalog, upgrade.discovers) : undefined;
    if (technology && !run.unlockedTechnologyIds.includes(technology.id)) {
      sites.push({ ...site, kind: 'addition', id: technology.worldAdditionId });
    }
  }
  return sites;
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
