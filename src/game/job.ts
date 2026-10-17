/**
 * The enterprise job (docs/feature_money.md §5.8): a fixed salary every month for as long as the
 * player builds nothing else. It takes all code, excludes gigs, is lost by switching away for
 * more than a moment, and at every payday a hidden draw may lay the player off anyway. Twelve
 * paydays make the contract permanent, which changes nothing.
 */
import { earned } from './ledger';
import type { Catalog } from './catalog';
import { marketRate, roundAmount } from './economy';
import { nextGig } from './gigs';
import { appendLog } from './log';
import { withoutProject } from './projectState';
import { nextFloat, nextInt } from './random';
import type { GameFact, ReadonlyRun, RunState } from './types';

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

/** A job offer can arrive (checked at each rent due). */
function canOffer(run: ReadonlyRun, catalog: Catalog): boolean {
  const j = run.job;
  return (
    run.rent.movedOut &&
    run.rent.month >= catalog.balance.job.offerFromMonth &&
    j.employed === null &&
    j.offer === null &&
    (j.cooldownUntilMs === null || run.activeMs >= j.cooldownUntilMs) &&
    !run.unlockedTechnologyIds.includes('product-management')
  );
}

/** At a rent due: maybe a recruiter (the draw happens only when an offer is possible). */
export function maybeOfferJob(run: RunState, catalog: Catalog): RunState {
  if (!canOffer(run, catalog)) return run;
  const b = catalog.balance.job;
  const draw = nextFloat(run.rng.gigs);
  const drawn: RunState = { ...run, rng: { ...run.rng, gigs: draw.state } };
  if (draw.value >= b.offerChance) return drawn;
  const salary = Math.max(
    1,
    Math.round(
      b.salaryShare *
        (catalog.balance.rent.monthMs / 1000) *
        // Flat: a senior gets no advantage (owner decision D34): what a novice would code.
        (run.economy.codeRate / (1 + run.experience)) *
        marketRate(run, catalog),
    ),
  );
  return appendLog(
    {
      ...drawn,
      job: { ...drawn.job, offer: { salary, expiresAtMs: run.activeMs + b.offerExpiresMs } },
    },
    fill(catalog.money.lines.jobOffer, { salary }),
    catalog,
  );
}

/** Accept the offer: the job becomes the only target and any gig is dropped. */
export function acceptJob(run: RunState, catalog: Catalog): { run: RunState; facts: GameFact[] } {
  const offer = run.job.offer;
  if (!offer) return { run, facts: [] };
  const hadGig = run.gigs.offer !== null;
  let next: RunState = {
    ...run,
    projects: withoutProject(run.projects, 'gig'),
    gigs: { ...run.gigs, offer: null, search: null },
    job: {
      ...run.job,
      offer: null,
      awayMs: 0,
      employed: { salary: offer.salary, monthEmployedMs: 0, paydays: 0, permanent: false },
    },
    history: [...run.history, { kind: 'job', event: 'hired', activeMs: run.activeMs }],
  };
  if (hadGig) next = appendLog(next, catalog.money.lines.abandonGig, catalog);
  next = appendLog(next, fill(catalog.money.lines.hired, { salary: offer.salary }), catalog);
  return { run: next, facts: [{ type: 'hired' }] };
}

/** Lose the job: final pay, a reason, History, cooldown; gigs return through a search. */
export function fire(
  run: RunState,
  finalPay: number,
  catalog: Catalog,
  alreadyPaid = false,
): { run: RunState; facts: GameFact[] } {
  const employed = run.job.employed;
  if (!employed) return { run, facts: [] };
  const reasons = catalog.money.firingReasons.filter(
    (r) => (!r.needsCat || run.cat.alive) && (!r.afterContract || employed.permanent),
  );
  const pick = nextInt(run.rng.gigs, 0, Math.max(0, reasons.length - 1));
  const reason = reasons[pick.value];
  const b = catalog.balance.job;
  let next: RunState = {
    ...run,
    rng: { ...run.rng, gigs: pick.state },
    economy: {
      ...run.economy,
      money: roundAmount(run.economy.money + (alreadyPaid ? 0 : finalPay)),
    },
    stats: earned(run.stats, 'salary', alreadyPaid ? 0 : finalPay),
    job: {
      ...run.job,
      employed: null,
      awayMs: 0,
      fired: run.job.fired + 1,
      cooldownUntilMs: run.activeMs + b.cooldownMonths * catalog.balance.rent.monthMs,
    },
    history: [...run.history, { kind: 'job', event: 'fired', activeMs: run.activeMs }],
  };
  next = appendLog(
    next,
    fill(catalog.money.lines.fired, { reason: reason?.text ?? 'the reorg', pay: finalPay }),
    catalog,
  );
  next = appendLog(next, catalog.money.lines.cooldown, catalog);
  // Gigs come back only through a search.
  if (next.gigs.offer === null && next.gigs.search === null) next = nextGig(next, catalog);
  return {
    run: next,
    facts: [{ type: 'fired', reasonId: reason?.id ?? 'reorg', finalPay }],
  };
}

/** Pay for the time employed this month so far. */
export function proRatedPay(run: ReadonlyRun, catalog: Catalog): number {
  const employed = run.job.employed;
  if (!employed) return 0;
  const share = Math.min(1, employed.monthEmployedMs / catalog.balance.rent.monthMs);
  return Math.round(employed.salary * share);
}

/**
 * Per step while employed: count the month, expire stale offers, and fire a player whose
 * target has been something else for longer than the grace.
 */
export function stepJob(
  run: RunState,
  stepMs: number,
  catalog: Catalog,
): { run: RunState; facts: GameFact[] } {
  let next = run;
  const offer = next.job.offer;
  if (offer && next.activeMs >= offer.expiresAtMs) {
    next = appendLog(
      { ...next, job: { ...next.job, offer: null } },
      catalog.money.lines.jobExpired,
      catalog,
    );
  }
  const employed = next.job.employed;
  if (!employed) return { run: next, facts: [] };
  const away = next.slots[0]?.target !== 'job';
  next = {
    ...next,
    job: {
      ...next.job,
      awayMs: away ? next.job.awayMs + stepMs : 0,
      employed: { ...employed, monthEmployedMs: employed.monthEmployedMs + stepMs },
    },
  };
  if (away && next.job.awayMs > catalog.balance.job.fireGraceMs) {
    return fire(next, proRatedPay(next, catalog), catalog);
  }
  return { run: next, facts: [] };
}

/**
 * Payday (rent day, before the rent): the month's pay, the tryout bar, the permanent contract
 * at the twelfth payday (before the draw), then the hidden layoff draw.
 */
export function payday(run: RunState, catalog: Catalog): { run: RunState; facts: GameFact[] } {
  const employed = run.job.employed;
  if (!employed) return { run, facts: [] };
  const pay = proRatedPay(run, catalog);
  const b = catalog.balance.job;
  const paydays = employed.paydays + 1;
  const contract = !employed.permanent && paydays >= b.tryoutMonths;
  let next: RunState = {
    ...run,
    economy: { ...run.economy, money: roundAmount(run.economy.money + pay) },
    stats: earned(run.stats, 'salary', pay),
    job: {
      ...run.job,
      employed: {
        ...employed,
        monthEmployedMs: 0,
        paydays,
        permanent: employed.permanent || contract,
      },
    },
  };
  next = appendLog(next, fill(catalog.money.lines.payday, { pay }), catalog);
  if (contract) {
    const first = !next.history.some(
      (e) => e.kind === 'milestone' && e.id === 'permanent-contract',
    );
    if (first) {
      next = {
        ...next,
        notices: [...next.notices, { kind: 'milestone', id: 'permanent-contract' }],
        history: [
          ...next.history,
          { kind: 'milestone', id: 'permanent-contract', activeMs: next.activeMs },
        ],
      };
    }
    next = appendLog(next, catalog.money.lines.contract, catalog);
  }
  const draw = nextFloat(next.rng.gigs);
  next = { ...next, rng: { ...next.rng, gigs: draw.state } };
  // The hidden layoff: same chance every payday, never shown. The final paycheck was just paid.
  if (draw.value < b.layoffChance) return fire(next, pay, catalog, true);
  return { run: next, facts: [] };
}
