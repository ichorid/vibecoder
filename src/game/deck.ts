/**
 * Read models for the build deck (docs/feature_build_deck.md §11): the build rows (what each
 * slot fills), the lane (every target or card, the builds among them, one tap away), the token gauge, and how
 * big the celebration of a completion is. Current state only, never the future catalog.
 */
import type { Catalog } from './catalog';
import { deriveRates, offerPrice, tokenDemandPerSecond, tokenPack, upgradeLevel } from './economy';
import { findUpgrade, isTokenReloadAvailable } from './progression';
import { companyPaysRent, rentFor } from './rent';
import type {
  GigViewModel,
  JobViewModel,
  MoneyStripViewModel,
  ProjectViewModel,
} from './projectViews';
import type {
  ChoiceOfferViewModel,
  DemoOfferViewModel,
  ReleaseOfferViewModel,
  UpgradeOfferViewModel,
} from './selectors';
import type { GameFact, ReadonlyRun } from './types';

interface DeckItemBase {
  /** Stable identity in the lane: a project key, `search`, or `choice:<id>`. */
  readonly key: string;
  readonly title: string;
  /** The build's progress (null for money cards, the search and decisions). */
  readonly project: ProjectViewModel | null;
}

export type DeckItemViewModel =
  | (DeckItemBase & { readonly kind: 'upgrade'; readonly offer: UpgradeOfferViewModel })
  | (DeckItemBase & { readonly kind: 'release'; readonly release: ReleaseOfferViewModel })
  | (DeckItemBase & { readonly kind: 'demo'; readonly demo: DemoOfferViewModel })
  | (DeckItemBase & { readonly kind: 'gig'; readonly gig: GigViewModel })
  | (DeckItemBase & {
      readonly kind: 'search';
      readonly search: { readonly done: number; readonly needed: number };
    })
  | (DeckItemBase & { readonly kind: 'job'; readonly job: JobViewModel })
  | (DeckItemBase & { readonly kind: 'choice'; readonly choice: ChoiceOfferViewModel });

export interface BuildRowViewModel {
  /** The slot index (0, or 1 with Worktrees). */
  readonly slot: number;
  readonly item: DeckItemViewModel;
}

export interface TokenGaugeViewModel {
  readonly tokens: number;
  /** Seconds until the tokens run out at the current burn (null: they do not run out). */
  readonly secondsLeft: number | null;
  /** Tokens relative to one pack, 0–1. */
  readonly fraction: number;
  readonly state: 'full' | 'low' | 'empty' | 'noMoney';
  readonly price: number;
  readonly packTokens: number;
  readonly affordable: boolean;
  readonly moneyAfter: number;
  /** A reload would leave less than the rent due soon (null: no such risk). */
  readonly rentRisk: { readonly rent: number; readonly dueInSeconds: number } | null;
  /** Owned auto-refill version (null: none). */
  readonly auto: 1 | 2 | null;
}

export interface DeckViewModel {
  readonly builds: readonly BuildRowViewModel[];
  readonly lane: readonly DeckItemViewModel[];
  readonly tokens: TokenGaugeViewModel | null;
  /** Manager Agent picks the next build: a completion does not ask the player. */
  readonly managed: boolean;
}

/** Below this many seconds of tokens the gauge warns. */
export const TOKENS_LOW_SECONDS = 30;
/** A reload warns about rent due within this many seconds. */
export const RENT_RISK_SECONDS = 120;

export function selectTokenGauge(run: ReadonlyRun, catalog: Catalog): TokenGaugeViewModel | null {
  const pack = catalog.upgrades.find((u) => u.pack === 'tokens');
  if (!pack || !isTokenReloadAvailable(run, pack)) return null;
  const rates = deriveRates(run, catalog);
  const burn = tokenDemandPerSecond(rates) - rates.tokenSupplyPerSecond;
  const tokens = Math.max(0, run.economy.tokens);
  const price = offerPrice(run, pack, catalog);
  const packTokens = tokenPack(run, catalog).tokens;
  const money = run.economy.money;
  const affordable = money >= price;
  const secondsLeft = burn > 1e-9 ? tokens / burn : null;
  const empty = secondsLeft !== null && tokens < catalog.balance.tokens.refillBelowTokens;
  const state = empty
    ? affordable
      ? 'empty'
      : 'noMoney'
    : secondsLeft !== null && secondsLeft < TOKENS_LOW_SECONDS
      ? 'low'
      : 'full';
  const moneyAfter = money - price;
  const due = run.rent.nextDueMs;
  const dueInSeconds = due === null ? null : Math.max(0, (due - run.activeMs) / 1000);
  const rent = rentDue(run, catalog);
  const v2 = upgradeLevel(run, 'auto-refill-v2') > 0;
  const v1 = upgradeLevel(run, 'auto-refill-v1') > 0;
  return {
    tokens: Math.floor(tokens),
    secondsLeft,
    fraction: packTokens > 0 ? Math.min(1, tokens / packTokens) : 0,
    state,
    price,
    packTokens,
    affordable,
    moneyAfter,
    rentRisk:
      rent !== null &&
      dueInSeconds !== null &&
      dueInSeconds < RENT_RISK_SECONDS &&
      moneyAfter < rent
        ? { rent, dueInSeconds }
        : null,
    auto: v2 ? 2 : v1 ? 1 : null,
  };
}

/** The rent the next due date asks for (null: none to pay). */
function rentDue(run: ReadonlyRun, catalog: Catalog): number | null {
  if (!run.rent.movedOut || companyPaysRent(run) || run.rent.nextDueMs === null) return null;
  return rentFor(run, run.rent.month + 1, catalog);
}

export type MomentTier = 'S' | 'A' | 'B';

/** How big the ta-da of a fact is (docs/feature_build_deck.md §8.1); null: none. */
export function momentTier(fact: GameFact, catalog: Catalog): MomentTier | null {
  if (fact.type === 'projectReady') return 'S';
  if (fact.type !== 'projectBuilt') return null;
  if (fact.id === 'gig') return 'B';
  const upgrade = findUpgrade(catalog, fact.id);
  if (!upgrade || upgrade.internal) return null;
  return upgrade.discovers ? 'S' : 'A';
}

export interface DeckParts {
  readonly slots: ReadonlyRun['slots'];
  /** Every offered card and decision in surface order (no three-card limit). */
  readonly ranked: readonly (UpgradeOfferViewModel | ChoiceOfferViewModel)[];
  readonly release: ReleaseOfferViewModel | null;
  readonly demo: DemoOfferViewModel | null;
  readonly money: MoneyStripViewModel | null;
  readonly job: JobViewModel | null;
  readonly managed: boolean;
  readonly tokens: TokenGaugeViewModel | null;
}

/** Unstarted cards the lane shows at most (as the old three-card surface). */
const LANE_CARDS = 3;

/** The build rows and the lane, from the pieces the Game view already computed. */
export function assembleDeck(parts: DeckParts): DeckViewModel {
  const items = new Map<string, DeckItemViewModel>();
  const { release, demo, money, job } = parts;
  if (release) {
    items.set('release', {
      key: 'release',
      kind: 'release',
      title: release.title,
      project: release.project,
      release,
    });
  }
  if (demo) {
    items.set('demo', {
      key: 'demo',
      kind: 'demo',
      title: `${demo.title} #${demo.number}`,
      project: demo.project,
      demo,
    });
  }
  if (money && !money.employed) {
    if (money.gig) {
      items.set('gig', {
        key: 'gig',
        kind: 'gig',
        title: money.gig.title,
        project: money.gig.project,
        gig: money.gig,
      });
    } else if (money.search) {
      items.set('search', {
        key: 'search',
        kind: 'search',
        title: 'Search for a gig',
        project: null,
        search: money.search,
      });
    }
  }
  if (job)
    items.set('job', { key: 'job', kind: 'job', title: job.title, project: job.project, job });
  const inSlot = new Set<string>(parts.slots.map((s) => s.target));
  const cards: DeckItemViewModel[] = [];
  let unstarted = 0;
  for (const card of parts.ranked) {
    if (card.kind === 'choice') {
      if (unstarted >= LANE_CARDS) continue;
      unstarted += 1;
      cards.push({
        key: `choice:${card.id}`,
        kind: 'choice',
        title: card.title,
        project: null,
        choice: card,
      });
      continue;
    }
    if (card.tokens !== undefined) continue;
    const item: DeckItemViewModel = {
      key: card.id,
      kind: 'upgrade',
      title: card.title,
      project: card.project,
      offer: card,
    };
    // What a slot builds is always in; it still counts against the limit, so a pick alone
    // never brings a card in or takes one out.
    const started = card.project !== null && card.project.code > 0;
    if (!started) {
      if (unstarted >= LANE_CARDS && !inSlot.has(card.id)) continue;
      unstarted += 1;
    }
    cards.push(item);
  }
  const lane = [...items.values(), ...cards];
  const byKey = new Map(lane.map((i) => [i.key, i]));
  const builds = parts.slots.flatMap((slot, index) => {
    const item = byKey.get(slot.target);
    return item ? [{ slot: index, item }] : [];
  });
  return { builds, lane, tokens: parts.tokens, managed: parts.managed };
}
