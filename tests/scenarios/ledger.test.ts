import { describe, expect, it } from 'vitest';
import { catalog } from '../../src/content/catalog';
import { createRun } from '../../src/game/createRun';
import { payday } from '../../src/game/job';
import { moneyLedger } from '../../src/game/ledger';
import type { RunState } from '../../src/game/types';
import { measureRun } from '../helpers/metrics';

/**
 * The money ledger: every dollar in or out is booked by kind, so the Setup screen can say where
 * the money came from and went. Whatever the route, the balance is what was earned minus what
 * was spent.
 */
function balanced(run: RunState): void {
  const ledger = moneyLedger(run);
  expect(ledger.earned - ledger.spent).toBeCloseTo(run.economy.money, 0);
}

describe('money ledger', { timeout: 300_000 }, () => {
  it('a freelancer through the whole game: gigs, rent, food, shopping and the company add up', () => {
    const m = measureRun(1);
    balanced(m.run);
    const ledger = moneyLedger(m.run);
    expect(ledger.in.gigs).toBeGreaterThan(0);
    expect(ledger.in.other).toBe(catalog.balance.gigs.savings);
    expect(ledger.out.rent).toBeGreaterThan(0);
    expect(ledger.out.shopping).toBeGreaterThan(0);
  });

  it('a payday books the salary', () => {
    const base = createRun(3, 'salary');
    const run: RunState = {
      ...base,
      job: {
        ...base.job,
        employed: {
          salary: 400,
          monthEmployedMs: catalog.balance.rent.monthMs,
          paydays: 0,
          permanent: false,
        },
      },
    };
    const paid = payday(run, catalog).run;
    expect(paid.economy.money).toBe(400);
    expect(moneyLedger(paid).in.salary).toBe(400);
    balanced(paid);
  });

  it('a careless player in and out of debt still balances (missed rents, the landlord)', () => {
    const m = measureRun(7, { freelance: -1, limitMin: 25 });
    balanced(m.run);
  });
});
