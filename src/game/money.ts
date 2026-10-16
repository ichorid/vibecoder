/**
 * The credit line: when operating costs exceed revenue the bank lends, down to a limit of
 * `creditSeconds` of costs, with interest. Its state is the (negative) bank balance itself.
 */
import type { Catalog } from './catalog';
import { creditLimit } from './economy';
import { appendLog } from './log';
import type { ReadonlyRun, RunState } from './types';

export interface CreditState {
  /** Money owed to the bank. */
  readonly owed: number;
  readonly limit: number;
  /** Seconds until the limit at the current net loss (null while recovering). */
  readonly secondsLeft: number | null;
}

export function creditState(run: ReadonlyRun, catalog: Catalog): CreditState | null {
  const owed = -run.economy.revenue;
  if (owed <= 0) return null;
  const limit = creditLimit(run.economy.costPerSecond, catalog.balance);
  const netLoss =
    run.economy.costPerSecond -
    run.economy.revenuePerSecond +
    owed * catalog.balance.money.interestPerSecond;
  return {
    owed,
    limit,
    secondsLeft: netLoss > 1e-9 ? Math.max(0, (limit - owed) / netLoss) : null,
  };
}

const NOTICES: readonly [id: string, share: number, text: string][] = [
  ['credit-open', 0, '🏦 The bank opened a line of credit. It is very understanding.'],
  ['credit-half', 0.5, '🏦 Half the credit line is gone. The bank sends a friendly reminder.'],
  ['credit-late', 0.9, '🏦 The bank has started calling. Nobody answers; the agents are busy.'],
];

/** One log line each when the run goes into the red, and at half and 90 % of the limit. */
export function creditNotices(run: RunState, catalog: Catalog): RunState {
  if (run.status !== 'playing') return run;
  const credit = creditState(run, catalog);
  if (!credit || credit.limit <= 0) return run;
  let next = run;
  for (const [id, share, text] of NOTICES) {
    if (next.narrative.fired.includes(id) || credit.owed < credit.limit * share) continue;
    next = appendLog(
      { ...next, narrative: { ...next.narrative, fired: [...next.narrative.fired, id] } },
      text,
      catalog,
    );
  }
  return next;
}
