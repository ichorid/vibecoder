/**
 * Gigs (docs/feature_money.md §5.2–5.4): money comes from coding for clients. A gig is a
 * project; its size and pay are drawn from `rng.gigs` when it is offered, so neither timing nor
 * a reload changes what it pays. Without a gig the player searches (a press per step); the
 * job-search bot and auto-freelancing search on their own.
 */
import { earned } from './ledger';
import type { Catalog } from './catalog';
import { marketEra, marketRate, roundAmount, roundNice, upgradeLevel } from './economy';
import { appendLog } from './log';
import { nextFloat, nextInt } from './random';
import type { GameFact, GigOffer, ReadonlyRun, RunState } from './types';

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

/** Gigs are offered from the first technology until the company exists. */
export function gigsOpen(run: ReadonlyRun): boolean {
  return (
    run.status === 'playing' &&
    run.unlockedTechnologyIds.length > 0 &&
    !run.unlockedTechnologyIds.includes('product-management')
  );
}

/** Money is on screen once the first gig was offered. */
export function moneyShown(run: ReadonlyRun): boolean {
  return run.narrative.fired.includes('first-gig');
}

/** Draw the next gig: size from the current code rate, pay from the market and luck. */
export function offerGig(run: RunState, catalog: Catalog): RunState {
  const g = catalog.balance.gigs;
  let rng = run.rng.gigs;
  // A gig asks for what a novice writes in `seconds` (owner decision D34): lessons make you
  // code faster, so a veteran finishes the same gig sooner, for the same pay.
  const noviceRate = run.economy.codeRate / (1 + run.experience);
  const size = Math.max(g.minSize, roundNice(g.seconds * noviceRate));
  const rate = marketRate(run, catalog);
  const luck = nextFloat(rng);
  rng = luck.state;
  const factor = g.payMin + (g.payMax - g.payMin) * luck.value;
  const tierDraw = nextFloat(rng);
  rng = tierDraw.state;
  const tier: GigOffer['tier'] =
    tierDraw.value < g.tipChance
      ? 'tip'
      : tierDraw.value < g.tipChance + g.ghostChance
        ? 'ghost'
        : 'normal';
  const tierFactor = tier === 'tip' ? g.tipFactor : tier === 'ghost' ? g.ghostFactor : 1;
  const client = nextInt(rng, 0, catalog.money.clients.length - 1);
  rng = client.state;
  const payment = nextInt(rng, 0, catalog.money.payments.length - 1);
  rng = payment.state;
  const offer: GigOffer = {
    size,
    pay: Math.max(1, Math.round(size * rate * factor * tierFactor)),
    tier,
    payMin: Math.max(1, Math.round(size * rate * g.payMin)),
    payMax: Math.max(1, Math.round(size * rate * g.payMax)),
    clientId: catalog.money.clients[client.value]?.id ?? '',
    paymentId: catalog.money.payments[payment.value]?.id ?? '',
  };
  return {
    ...run,
    rng: { ...run.rng, gigs: rng },
    gigs: { ...run.gigs, offer, search: null },
  };
}

/** Start a search of `searchMin`–`searchMax` presses (the board is empty). */
function startSearch(run: RunState, catalog: Catalog): RunState {
  const g = catalog.balance.gigs;
  const needed = nextInt(run.rng.gigs, g.searchMin, g.searchMax);
  return {
    ...run,
    rng: { ...run.rng, gigs: needed.state },
    gigs: { ...run.gigs, offer: null, search: { done: 0, needed: needed.value } },
  };
}

/** After a gig is paid or abandoned: another one waits, or the board is empty. */
export function nextGig(run: RunState, catalog: Catalog): RunState {
  if (!gigsOpen(run)) return { ...run, gigs: { ...run.gigs, offer: null, search: null } };
  const draw = nextFloat(run.rng.gigs);
  const drawn: RunState = { ...run, rng: { ...run.rng, gigs: draw.state } };
  if (draw.value < catalog.balance.gigs.nextChance) return offerGig(drawn, catalog);
  return appendLog(startSearch(drawn, catalog), catalog.money.lines.noGigs, catalog);
}

/** One search step (a press, or the bot). At the last one a gig appears. */
export function searchStep(run: RunState, catalog: Catalog): RunState {
  const search = run.gigs.search;
  if (!search || !gigsOpen(run) || run.job.employed) return run;
  const done = search.done + 1;
  if (done < search.needed) return { ...run, gigs: { ...run.gigs, search: { ...search, done } } };
  return offerGig(run, catalog);
}

/** Money paid in when money first appears (the savings) and when the player moves out. */
export function payGig(run: RunState, catalog: Catalog): { run: RunState; facts: GameFact[] } {
  const offer = run.gigs.offer;
  if (!offer) return { run, facts: [] };
  const lines = catalog.money.lines;
  let next: RunState = {
    ...run,
    economy: { ...run.economy, money: roundAmount(run.economy.money + offer.pay) },
    gigs: { ...run.gigs, offer: null, paid: run.gigs.paid + 1 },
    stats: earned(
      { ...run.stats, gigCode: roundAmount(run.stats.gigCode + offer.size) },
      'gigs',
      offer.pay,
    ),
  };
  const payment = catalog.money.payments.find((p) => p.id === offer.paymentId);
  const paidLine =
    offer.tier === 'tip' ? lines.gigTip : offer.tier === 'ghost' ? lines.gigGhost : lines.gigPaid;
  next = appendLog(
    next,
    fill(paidLine, {
      pay: offer.pay,
      payment: payment
        ? typeof payment.text === 'string'
          ? payment.text
          : payment.text.alive
        : '',
    }),
    catalog,
  );
  if (!next.rent.movedOut) next = moveOut(next, lines.movedOut, catalog);
  next = nextGig(next, catalog);
  return { run: next, facts: [{ type: 'gigPaid', amount: offer.pay }] };
}

/** Rent starts: a month from now, then every month. */
function moveOut(run: RunState, line: string, catalog: Catalog): RunState {
  const monthMs = catalog.balance.rent.monthMs;
  return appendLog(
    {
      ...run,
      rent: { ...run.rent, movedOut: true, month: 0, nextDueMs: run.activeMs + monthMs },
      history: [...run.history, { kind: 'money', id: 'moved-out', activeMs: run.activeMs }],
    },
    line,
    catalog,
  );
}

/**
 * Per step: the first gig (with the savings), the bot's searches, the end of gigs when the
 * company exists, and market updates (a notice, a History entry and a log line each).
 */
export function stepGigs(run: RunState, stepMs: number, catalog: Catalog): RunState {
  if (run.status !== 'playing') return run;
  let next = run;
  const lines = catalog.money.lines;
  if (!moneyShown(next) && gigsOpen(next)) {
    next = {
      ...next,
      narrative: { ...next.narrative, fired: [...next.narrative.fired, 'first-gig'] },
      economy: {
        ...next.economy,
        money: roundAmount(next.economy.money + catalog.balance.gigs.savings),
      },
      stats: earned(next.stats, 'other', catalog.balance.gigs.savings),
    };
    next = appendLog(offerGig(next, catalog), lines.firstGig, catalog);
  }
  // Nobody stays at their parents' forever: the first market update moves the player out.
  if (!next.rent.movedOut && gigsOpen(next) && marketEra(next, catalog) > 0) {
    next = moveOut(next, lines.evictedByParents, catalog);
  }
  // The company takes over the money: no new gigs (one in progress still pays).
  if (
    moneyShown(next) &&
    !gigsOpen(next) &&
    next.status === 'playing' &&
    !next.narrative.fired.includes('gigs-end')
  ) {
    next = appendLog(
      {
        ...next,
        narrative: { ...next.narrative, fired: [...next.narrative.fired, 'gigs-end'] },
        gigs: {
          ...next.gigs,
          search: null,
          offer: (next.projects.gig?.code ?? 0) > 0 ? next.gigs.offer : null,
        },
      },
      lines.gigsEnd,
      catalog,
    );
  }
  const bot =
    upgradeLevel(next, 'job-search-bot') > 0 || upgradeLevel(next, 'auto-freelancing') > 0;
  if (bot && next.gigs.search && !next.job.employed) {
    let botMs = next.gigs.botMs + stepMs;
    const every = catalog.balance.gigs.botEveryMs;
    let searched = false;
    while (botMs >= every && next.gigs.search) {
      botMs -= every;
      const before = next;
      next = searchStep(next, catalog);
      if (next === before) break;
      searched = true;
    }
    next = { ...next, gigs: { ...next.gigs, botMs } };
    // The bot found one: a line from its pool (in turn, so each is heard).
    if (searched && next.gigs.offer) {
      const pool = upgradeLevel(next, 'auto-freelancing') > 0 ? lines.freelance : lines.bot;
      const line = pool[next.gigs.paid % Math.max(1, pool.length)];
      if (line) next = appendLog(next, line, catalog);
    }
  }
  return marketUpdates(next, catalog);
}

/** A market update for each era reached since the last one (none for the first era). */
function marketUpdates(run: RunState, catalog: Catalog): RunState {
  const era = marketEra(run, catalog);
  const seen = run.history.reduce((m, e) => (e.kind === 'market' ? Math.max(m, e.era) : m), 0);
  if (era <= seen || !moneyShown(run)) return run;
  let next = run;
  for (let e = seen + 1; e <= era; e += 1) {
    const definition = catalog.money.eras[e];
    if (!definition) continue;
    next = appendLog(
      {
        ...next,
        notices: [...next.notices, { kind: 'market', era: e }],
        history: [...next.history, { kind: 'market', era: e, activeMs: next.activeMs }],
      },
      `📉 ${definition.text}`,
      catalog,
    );
  }
  return next;
}
