/**
 * The money ledger: every dollar in or out of `economy.money` is booked by kind in the run's
 * stats, so the Setup screen can say where the money came from and where it went.
 */
import { roundAmount } from './economy';
import type { ReadonlyRun, RunStats } from './types';

/** Where money comes from: gigs, the job's salary, company revenue, and the rest (savings). */
export type MoneySource = 'gigs' | 'salary' | 'revenue' | 'other';
/** Where it goes: rent, the cat's food, shopping (cards, token packs), company costs. */
export type MoneySink = 'rent' | 'food' | 'shopping' | 'company';

const SOURCE_FIELD = {
  gigs: 'earnedGigs',
  salary: 'earnedSalary',
  revenue: 'earnedRevenue',
  other: 'earnedOther',
} as const satisfies Record<MoneySource, keyof RunStats>;
const SINK_FIELD = {
  rent: 'spentRent',
  food: 'spentFood',
  shopping: 'spentShopping',
  company: 'spentCompany',
} as const satisfies Record<MoneySink, keyof RunStats>;

/** Book money earned from `source` (the caller changes `economy.money` itself). */
export function earned(stats: RunStats, source: MoneySource, amount: number): RunStats {
  const field = SOURCE_FIELD[source];
  return { ...stats, [field]: roundAmount(stats[field] + amount) };
}

/** Book money spent on `sink` (the caller changes `economy.money` itself). */
export function spent(stats: RunStats, sink: MoneySink, amount: number): RunStats {
  const field = SINK_FIELD[sink];
  return { ...stats, [field]: roundAmount(stats[field] + amount) };
}

export interface MoneyLedger {
  readonly in: Readonly<Record<MoneySource, number>>;
  readonly out: Readonly<Record<MoneySink, number>>;
  readonly earned: number;
  readonly spent: number;
}

export function moneyLedger(run: ReadonlyRun): MoneyLedger {
  const s = run.stats;
  const inflow = {
    gigs: s.earnedGigs,
    salary: s.earnedSalary,
    revenue: s.earnedRevenue,
    other: s.earnedOther,
  };
  const outflow = {
    rent: s.spentRent,
    food: s.spentFood,
    shopping: s.spentShopping,
    company: s.spentCompany,
  };
  const sum = (values: Record<string, number>) =>
    roundAmount(Object.values(values).reduce((a, b) => a + b, 0));
  return { in: inflow, out: outflow, earned: sum(inflow), spent: sum(outflow) };
}
