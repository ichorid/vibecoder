import { earned, spent } from './ledger';
import { evaluateChatter } from './chatter';
import { creditNotices } from './money';
import { updatePlant } from './plant';
import { releaseNotices } from './releases';
import { demoNotice } from './demos';
import { updateAttention, updateCat } from './cat';
import { advanceSession, sessionOf, withSession } from './catPlaySession';
import type { Catalog } from './catalog';
import {
  deriveRates,
  marketRate,
  offerPrice,
  roundAmount,
  stepEconomy,
  tokenDemandPerSecond,
  tokenPack,
} from './economy';
import { nextFloat } from './random';
import { appendLog } from './log';
import { resolveAutomaticEnding } from './endings';
import { evaluateAchievements, evaluateNarrative, isQuietStep } from './narrative';
import { stepGigs } from './gigs';
import { stepJob } from './job';
import { stepProjects } from './projects';
import { stepRent } from './rent';
import type { GameFact, RunState } from './types';

/** Debt at or below this counts as a clean pipeline. */
const LOW_DEBT = 5;

export interface Transition {
  readonly run: RunState;
  readonly facts: readonly GameFact[];
}

/**
 * One fixed simulation step, applied in the architecture's order:
 * 1. active time, 2. production, (3. cat, 4. progression, 5. narrative/endings added later),
 * 6. facts for presentation. Never mutates its input.
 */
export function stepRun(run: RunState, stepMs: number, catalog: Catalog): Transition {
  if (run.status !== 'playing') return { run, facts: [] };
  const facts: GameFact[] = [];
  const activeMs = run.activeMs + stepMs;

  // 2. Production, costs and capacity constraints.
  const economy = stepEconomy(run.economy, deriveRates(run, catalog), stepMs, catalog.balance);
  const margin = economy.economy.revenuePerSecond - economy.economy.costPerSecond;
  const monetized = economy.economy.revenuePerSecond > 0 || economy.economy.costPerSecond > 0;
  // The company's books: revenue in; costs and interest are whatever else moved the money.
  const revenue = roundAmount(economy.economy.revenuePerSecond * (stepMs / 1000));
  const moved = roundAmount(economy.economy.money - run.economy.money);
  const books = spent(earned(run.stats, 'revenue', revenue), 'company', revenue - moved);
  let next: RunState = {
    ...run,
    activeMs,
    economy: economy.economy,
    stats: {
      ...books,
      lifetimeOutput: roundAmount(run.stats.lifetimeOutput + economy.produced),
      // A clean pipeline counts from Evaluations: the checks have to exist to stay green.
      lowDebtMs:
        economy.economy.debt <= LOW_DEBT && run.unlockedTechnologyIds.includes('evaluations')
          ? run.stats.lowDebtMs + stepMs
          : 0,
      positiveMarginMs: monetized && margin > 0 ? run.stats.positiveMarginMs + stepMs : 0,
      negativeMarginMs: monetized && margin < 0 ? run.stats.negativeMarginMs + stepMs : 0,
    },
  };

  // 2a. The code goes into the build slots' projects (completions, discoveries, gigs paid).
  const built = stepProjects(next, economy.produced, economy.manual, catalog);
  next = built.run;
  facts.push(...built.facts);

  // 2b. Token automation: auto-refill (v1 has a bug) and the auto-reviewer.
  next = tokenAutomation(next, stepMs, catalog);

  // 2c. Money: gigs and the market, the job, rent day and the landlord.
  next = stepGigs(next, stepMs, catalog);
  const job = stepJob(next, stepMs, catalog);
  next = job.run;
  facts.push(...job.facts);
  const rent = stepRent(next, catalog);
  next = rent.run;
  facts.push(...rent.facts);
  if (next.status !== 'playing') return { run: next, facts };

  // 3. Cat needs, health and terminal death.
  const cat = updateCat(next.cat, stepMs, catalog.balance.cat);
  next = { ...next, cat: cat.cat };
  if (cat.events.some((event) => event.type === 'died')) next = recordDeath(next, catalog, facts);
  else if (cat.events.some((event) => event.type === 'left')) next = recordStray(next, facts);
  else if (next.catPlay) {
    next = withSession(next, advanceSession(sessionOf(next), activeMs, catalog.balance.catPlay));
  }
  // 5. Automatic endings (after the cat, so the fate variant is unambiguous), then narrative.
  const automatic = resolveAutomaticEnding(next, catalog);
  next = automatic.run;
  facts.push(...automatic.facts);
  next = updatePlant(next, stepMs, catalog);
  // A release that became available, and the credit line's milestones, get one line each.
  next = releaseNotices(next, catalog);
  next = demoNotice(next, catalog);
  next = creditNotices(next, catalog);
  // Narrative events (quiet when something important happened this step).
  const linesBefore = next.log.length;
  next = evaluateNarrative(next, catalog, facts);
  // Console chatter only on an otherwise quiet step (one ambient line at most).
  if (next.log.length === linesBefore && !isQuietStep(facts)) next = evaluateChatter(next, catalog);
  next = evaluateAchievements(next, catalog);
  const attention = updateAttention(next.attention, next.cat, activeMs, catalog.balance.attention);
  if (attention !== next.attention) next = { ...next, attention };

  return { run: next, facts };
}

/** Atomic death transaction: death time, one History entry, one understated log line. */
function recordDeath(run: RunState, catalog: Catalog, facts: GameFact[]): RunState {
  facts.push({ type: 'catDied' });
  const dead: RunState = {
    ...run,
    cat: { ...run.cat, alive: false, health: 0, diedAtActiveMs: run.activeMs },
    catPlay: null,
    history: [...run.history, { kind: 'cat', id: 'cat-died', activeMs: run.activeMs }],
  };
  return appendLog(dead, `🕯️ ${catalog.catText.conditions.dead}`, catalog);
}

/** The cat walks out: its time and one History entry, but no log line — nobody saw it go. */
function recordStray(run: RunState, facts: GameFact[]): RunState {
  facts.push({ type: 'catLeft' });
  return {
    ...run,
    cat: { ...run.cat, alive: false, leftAtActiveMs: run.activeMs },
    catPlay: null,
    history: [...run.history, { kind: 'cat', id: 'cat-left', activeMs: run.activeMs }],
  };
}

/**
 * Auto-refill buys one pack only when the tokens have run out (below `refillBelowTokens`) and
 * the money is there. Version 1's bug: its first disaster lands uniformly on refill 3–6 (a seeded
 * "pity timer", so it reliably happens soon), later ones with a fixed chance; a disaster deletes
 * `disasterLoss` of the money — at least `disasterSeconds` of what the code earns, at most
 * what there is — (paid to the wrong account) and buys nothing. The auto-reviewer adds a small permanent
 * rate bonus every interval up to its cap.
 */
function tokenAutomation(run: RunState, stepMs: number, catalog: Catalog): RunState {
  const rates = deriveRates(run, catalog);
  const t = catalog.balance.tokens;
  let next = run;
  if (rates.autoReview && next.economy.tokenReviewBonus < t.autoReviewCap) {
    let elapsed = next.economy.autoReviewMs + stepMs;
    let bonus = next.economy.tokenReviewBonus;
    while (elapsed >= t.autoReviewEveryMs && bonus < t.autoReviewCap) {
      elapsed -= t.autoReviewEveryMs;
      bonus = Math.min(t.autoReviewCap, roundAmount(bonus + t.autoReviewStep));
    }
    next = {
      ...next,
      economy: { ...next.economy, tokenReviewBonus: bonus, autoReviewMs: elapsed },
    };
  }
  if (rates.autoRefill === 0) return next;
  const demand = tokenDemandPerSecond(rates);
  if (demand <= 0 || next.economy.tokens >= t.refillBelowTokens) return next;
  const pack = tokenPack(next, catalog);
  const definition = catalog.upgrades.find((u) => u.pack === 'tokens');
  const price = definition ? offerPrice(next, definition, catalog) : pack.price;
  if (next.economy.money < price) return next;
  if (rates.autoRefill === 2) {
    return {
      ...next,
      economy: {
        ...next.economy,
        money: roundAmount(next.economy.money - price),
        tokens: roundAmount(next.economy.tokens + pack.tokens),
      },
      stats: spent(next.stats, 'shopping', price),
    };
  }
  const refills = next.economy.autoRefills + 1;
  const draw = nextFloat(next.rng.economy);
  const chance =
    next.stats.refillDisasters > 0
      ? t.laterDisasterChance
      : refills < t.firstDisasterFrom
        ? 0
        : 1 / (t.firstDisasterTo - refills + 1);
  const rng = { ...next.rng, economy: draw.state };
  if (draw.value < chance) {
    // Paid into the wrong account: half the money, at least `disasterSeconds` of what the
    // current code is worth on the market, never more than there is.
    const bank = Math.max(0, next.economy.money);
    const perSecond = next.economy.codeRate * marketRate(next, catalog);
    const loss = Math.min(bank, Math.max(bank * t.disasterLoss, t.disasterSeconds * perSecond));
    const crashed: RunState = {
      ...next,
      rng,
      economy: {
        ...next.economy,
        autoRefills: refills,
        money: roundAmount(next.economy.money - loss),
      },
      stats: spent(
        { ...next.stats, refillDisasters: next.stats.refillDisasters + 1 },
        'shopping',
        loss,
      ),
    };
    const story =
      next.stats.refillDisasters % 2 === 0
        ? '💸 Auto-refill v1 paid for tokens into the wrong account: your code is gone, no tokens arrived.'
        : '💸 Auto-refill v1 donated your tokens to charity. It spent your code doing it.';
    return appendLog(crashed, story, catalog);
  }
  return {
    ...next,
    rng,
    economy: {
      ...next.economy,
      autoRefills: refills,
      money: roundAmount(next.economy.money - price),
      tokens: roundAmount(next.economy.tokens + pack.tokens),
    },
    stats: spent(next.stats, 'shopping', price),
  };
}
