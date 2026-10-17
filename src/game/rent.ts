/**
 * Rent (docs/feature_money.md §5.5–5.6): a bill every month after moving out, a dollar more each
 * month, quietly. A rent the money cannot cover is charged anyway and spins the landlord wheel:
 * the eviction slice grows with each month missed in a row, and eviction ends the run. The draw
 * is committed at the due time from `rng.rent`; the wheel only animates it later.
 */
import { spent } from './ledger';
import type { Catalog } from './catalog';
import { catAware } from './catAware';
import { roundAmount } from './economy';
import { endRun } from './endings';
import { maybeOfferJob, payday } from './job';
import { appendLog } from './log';
import { nextFloat, nextInt } from './random';
import type { GameFact, ReadonlyRun, RentRecord, RunState } from './types';

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

/** Rent for month `month` (1-based) of this run. */
export function rentFor(run: ReadonlyRun, month: number, catalog: Catalog): number {
  const r = catalog.balance.rent;
  return Math.round((r.base + r.creep * Math.max(0, month - 1)) * run.frugal);
}

/** The company pays the rent from Product Management on. */
export function companyPaysRent(run: ReadonlyRun): boolean {
  return run.unlockedTechnologyIds.includes('product-management');
}

/** Eviction chance for the `streak`-th missed month in a row (the last value repeats). */
export function evictionHazard(catalog: Catalog, streak: number): number {
  const h = catalog.money.evictionHazards;
  return h[Math.min(Math.max(1, streak), h.length) - 1] ?? 1;
}

/** Per step: rent day (payday first, maybe a recruiter, then the bill). */
export function stepRent(run: RunState, catalog: Catalog): { run: RunState; facts: GameFact[] } {
  if (run.status !== 'playing' || !run.rent.movedOut) return { run, facts: [] };
  if (companyPaysRent(run)) {
    if (run.narrative.fired.includes('company-pays-rent')) return { run, facts: [] };
    return {
      run: appendLog(
        {
          ...run,
          rent: { ...run.rent, nextDueMs: null },
          narrative: { ...run.narrative, fired: [...run.narrative.fired, 'company-pays-rent'] },
          history: [
            ...run.history,
            { kind: 'money', id: 'company-pays-rent', activeMs: run.activeMs },
          ],
        },
        catalog.money.lines.companyPaysRent,
        catalog,
      ),
      facts: [],
    };
  }
  const due = run.rent.nextDueMs;
  if (due === null || run.activeMs < due) return { run, facts: [] };
  const facts: GameFact[] = [];
  const month = run.rent.month + 1;
  let next: RunState = {
    ...run,
    rent: { ...run.rent, month, nextDueMs: due + catalog.balance.rent.monthMs },
  };
  const paid = payday(next, catalog);
  next = paid.run;
  facts.push(...paid.facts);
  next = maybeOfferJob(next, catalog);
  const rent = rentFor(next, month, catalog);
  if (next.economy.money >= rent) {
    next = {
      ...next,
      economy: { ...next.economy, money: roundAmount(next.economy.money - rent) },
      stats: spent(next.stats, 'rent', rent),
      rent: { ...next.rent, missedStreak: 0 },
    };
    return { run: appendLog(next, fill(catalog.money.lines.rentPaid, { rent }), catalog), facts };
  }
  return missedRent(next, rent, catalog, facts);
}

/** The rent is charged anyway; the landlord wheel decides what happens. */
function missedRent(
  run: RunState,
  rent: number,
  catalog: Catalog,
  facts: GameFact[],
): { run: RunState; facts: GameFact[] } {
  const streak = run.rent.missedStreak + 1;
  const hazard = evictionHazard(catalog, streak);
  let rng = run.rng.rent;
  const roll = nextFloat(rng);
  rng = roll.state;
  const evicted = roll.value < hazard;
  let outcome: RentRecord['outcome'] = 'evicted';
  let share = 0;
  if (!evicted) {
    const used = new Set(run.rentWheels.map((r) => r.outcome));
    const fresh = catalog.money.rentSlices.filter((s) => !used.has(s.id));
    const slices = fresh.length > 0 ? fresh : catalog.money.rentSlices;
    const pick = nextInt(rng, 0, slices.length - 1);
    rng = pick.state;
    const slice = slices[pick.value];
    outcome = slice?.id ?? 'forgot';
    share = slice?.rentShare ?? 0;
  }
  const record: RentRecord = {
    month: run.rent.month,
    outcome,
    hazard,
    rent,
    catAlive: run.cat.alive,
    activeMs: run.activeMs,
  };
  const slice = catalog.money.rentSlices.find((s) => s.id === outcome);
  let next: RunState = {
    ...run,
    rng: { ...run.rng, rent: rng },
    economy: { ...run.economy, money: roundAmount(run.economy.money - rent + share * rent) },
    stats: spent(run.stats, 'rent', rent - share * rent),
    rent: { ...run.rent, missedStreak: streak, missedTotal: run.rent.missedTotal + 1 },
    rentWheels: [...run.rentWheels, record],
  };
  next = appendLog(
    next,
    fill(catalog.money.lines.rentMissed, {
      rent,
      text: slice ? catAware(slice.text, run.cat.alive) : catalog.money.evictedLabel,
    }),
    catalog,
  );
  facts.push({ type: 'rentMissed', outcome });
  if (!evicted) return { run: next, facts };
  const ended = endRun(next, catalog.money.evictionEnding);
  return { run: ended.run, facts: [...facts, ...ended.facts] };
}
