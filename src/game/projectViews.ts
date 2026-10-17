/**
 * Read models for projects and money (docs/feature_projects.md §7, docs/feature_money.md §6):
 * a project's fill, ETA and badge; the money strip; the enterprise job card; the landlord
 * wheel; market updates and milestones. Current state only, never the future catalog.
 */
import type { Catalog } from './catalog';
import { catAware } from './catAware';
import { marketEra } from './economy';
import { moneyShown } from './gigs';
import { proRatedPay } from './job';
import { isProjectAvailable, isReady, projectCode, projectPrice, slotFactor } from './projects';
import { companyPaysRent, evictionHazard, rentFor } from './rent';
import type { ProjectKey, ReadonlyRun, RentRecord } from './types';

/** BUILDING: the player's pick; AUTO: the system's; AUTO_HALF: a fallback at reduced rate. */
export type ProjectBadge = 'building' | 'auto' | 'auto-half' | 'paused' | 'employed' | null;

export interface ProjectViewModel {
  readonly code: number;
  /** Frozen once started; null for the job (it never completes). */
  readonly price: number | null;
  /** 0–1 (always 0 for the job). */
  readonly progress: number;
  /** Seconds to done at the current pace (null: never, or nothing flows). */
  readonly etaSeconds: number | null;
  readonly badge: ProjectBadge;
  /** A release or demo that holds its price and waits for the player. */
  readonly ready: boolean;
  /** Tapping it would pick it (or confirm a fallback). */
  readonly selectable: boolean;
}

/** One project's progress, pace and badge. */
export function projectView(run: ReadonlyRun, key: ProjectKey, catalog: Catalog): ProjectViewModel {
  const price = projectPrice(run, key, catalog);
  const code = projectCode(run, key);
  const index = run.slots.findIndex((s) => s.target === key);
  const slot = index >= 0 ? run.slots[index] : undefined;
  const employed = run.job.employed !== null;
  const share = run.slots.length > 0 ? 1 / run.slots.length : 1;
  const factor = slot ? slotFactor(run, slot, catalog) : 1;
  let badge: ProjectBadge = null;
  if (key === 'job' && employed) badge = 'employed';
  else if (employed) badge = code > 0 || slot ? 'paused' : null;
  else if (slot) {
    badge =
      slot.by === 'player'
        ? 'building'
        : slot.by === 'system'
          ? 'auto'
          : factor < 1
            ? 'auto-half'
            : 'auto';
  } else if (code > 0) badge = 'paused';
  const ready = isReady(run, key, catalog);
  const rate = employed ? 0 : run.economy.codeRate * share * factor;
  const left = price === null ? null : Math.max(0, price - code);
  return {
    code,
    price,
    progress: price ? Math.min(1, code / price) : 0,
    etaSeconds: left === null || ready ? null : rate > 1e-6 ? left / rate : null,
    badge,
    ready,
    selectable:
      isProjectAvailable(run, key, catalog) &&
      !run.unlockedTechnologyIds.includes('autonomous-company'),
  };
}

export interface GigViewModel {
  readonly title: string;
  readonly payMin: number;
  readonly payMax: number;
  readonly project: ProjectViewModel;
}

export interface MoneyStripViewModel {
  readonly balance: number;
  /** Seconds until rent is due (null before moving out or once the company pays). */
  readonly rentInSeconds: number | null;
  readonly rent: number | null;
  readonly missedStreak: number;
  readonly gig: GigViewModel | null;
  /** No gig: SEARCH presses done of needed. */
  readonly search: { readonly done: number; readonly needed: number } | null;
  /** The job holds all the code: no gigs, no search. */
  readonly employed: boolean;
  /** The FEED button's price (0 before moving out). */
  readonly foodCost: number;
}

export function selectMoney(run: ReadonlyRun, catalog: Catalog): MoneyStripViewModel | null {
  if (!moneyShown(run)) return null;
  const offer = run.gigs.offer;
  const client = offer ? catalog.money.clients.find((c) => c.id === offer.clientId) : undefined;
  const due = run.rent.nextDueMs;
  const paysRent = run.rent.movedOut && !companyPaysRent(run) && due !== null;
  return {
    balance: Math.floor(run.economy.money),
    rentInSeconds: paysRent ? Math.max(0, (due - run.activeMs) / 1000) : null,
    rent: paysRent ? rentFor(run, run.rent.month + 1, catalog) : null,
    missedStreak: run.rent.missedStreak,
    gig: offer
      ? {
          title: client ? catAware(client.text, run.cat.alive) : 'A gig',
          payMin: offer.payMin,
          payMax: offer.payMax,
          project: projectView(run, 'gig', catalog),
        }
      : null,
    search: run.job.employed ? null : run.gigs.search,
    employed: run.job.employed !== null,
    foodCost: run.rent.movedOut ? catalog.balance.rent.foodPerFeed : 0,
  };
}

export interface JobViewModel {
  readonly title: string;
  readonly salary: number;
  /** Seconds the offer still stands (null once employed). */
  readonly expiresInSeconds: number | null;
  readonly employed: boolean;
  /** The tryout bar (null before accepting). Never the layoff chance. */
  readonly tenure: {
    readonly paydays: number;
    readonly of: number;
    readonly monthFraction: number;
    readonly permanent: boolean;
  } | null;
  /** Pay so far this month. */
  readonly earned: number;
  readonly project: ProjectViewModel;
}

export function selectJob(run: ReadonlyRun, catalog: Catalog): JobViewModel | null {
  const { offer, employed } = run.job;
  if (run.status !== 'playing' || (!offer && !employed)) return null;
  const month = catalog.balance.rent.monthMs;
  return {
    title: 'Enterprise Solutions Inc.',
    salary: employed?.salary ?? offer?.salary ?? 0,
    expiresInSeconds: offer ? Math.max(0, (offer.expiresAtMs - run.activeMs) / 1000) : null,
    employed: employed !== null,
    tenure: employed
      ? {
          paydays: Math.min(employed.paydays, catalog.balance.job.tryoutMonths),
          of: catalog.balance.job.tryoutMonths,
          monthFraction: Math.min(1, employed.monthEmployedMs / month),
          permanent: employed.permanent,
        }
      : null,
    earned: proRatedPay(run, catalog),
    project: projectView(run, 'job', catalog),
  };
}

export interface RentWheelViewModel {
  /** Which record this is (acknowledge after the spin). */
  readonly index: number;
  /** The month (the release wheel's `window`). */
  readonly window: number;
  /** What the wheel's kicker reads, e.g. "RENT $104". */
  readonly version: string;
  /** The true chance of the red slice on this spin (0–1). */
  readonly hazard: number;
  /** Equal slices, then the red one last (`gold` marks the special slice, as on the release wheel). */
  readonly slices: readonly {
    readonly id: string;
    readonly label: string;
    readonly gold: boolean;
  }[];
  /** Index into `slices` of where the wheel lands. */
  readonly target: number;
  readonly spinSeed: number;
  readonly result: {
    /** Evicted. */
    readonly jackpot: boolean;
    readonly label: string;
    readonly text: string;
    readonly comment: null;
  };
}

/** The next landlord wheel the player has not watched yet (the same honest wheel as releases). */
export function selectRentWheel(run: ReadonlyRun, catalog: Catalog): RentWheelViewModel | null {
  const record: RentRecord | undefined = run.rentWheels[run.rentWheelsSeen];
  if (!record) return null;
  const slices = catalog.money.rentSlices;
  const evicted = record.outcome === 'evicted';
  const index = slices.findIndex((s) => s.id === record.outcome);
  const slice = slices[index];
  return {
    index: run.rentWheelsSeen,
    window: record.month,
    version: `RENT $${record.rent}`,
    hazard: record.hazard,
    slices: [
      ...slices.map((s) => ({ id: s.id, label: catAware(s.label, record.catAlive), gold: false })),
      { id: 'evicted', label: catalog.money.evictedLabel, gold: true },
    ],
    target: evicted ? slices.length : Math.max(0, index),
    spinSeed: (run.visualSeed ^ Math.imul(run.rentWheelsSeen + 1, 2654435761)) >>> 0,
    result: {
      jackpot: evicted,
      label: slice ? catAware(slice.label, record.catAlive) : catalog.money.evictedLabel,
      text: slice
        ? catAware(slice.text, record.catAlive)
        : 'The landlord changed the locks. Your things are on the pavement.',
      comment: null,
    },
  };
}

/** The eviction chance the next missed rent would face (for the strip's "missed ×k"). */
export function nextEvictionHazard(run: ReadonlyRun, catalog: Catalog): number {
  return evictionHazard(catalog, run.rent.missedStreak + 1);
}

export interface NoticeViewModel {
  readonly kind: 'market' | 'milestone';
  readonly kicker: string;
  readonly title: string;
  readonly text: string;
  readonly illustrationId: string | null;
}

/** The next market update or milestone panel. */
export function selectNotice(run: ReadonlyRun, catalog: Catalog): NoticeViewModel | null {
  const notice = run.notices[0];
  if (!notice) return null;
  if (notice.kind === 'market') {
    const era = catalog.money.eras[notice.era];
    return {
      kind: 'market',
      kicker: 'MARKET UPDATE',
      title: era?.title ?? 'Market update',
      text: era?.text ?? '',
      illustrationId: null,
    };
  }
  return {
    kind: 'milestone',
    kicker: 'HISTORIC MILESTONE',
    title: catalog.money.contract.title,
    text: catalog.money.contract.text,
    illustrationId: catalog.money.contract.illustrationId,
  };
}

/** The era index (0 = before any market update), for presentation. */
export function selectMarketEra(run: ReadonlyRun, catalog: Catalog): number {
  return marketEra(run, catalog);
}
