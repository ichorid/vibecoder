import type { BalanceDefinition, Catalog, Effect, UpgradeDefinition } from './catalog';
import { RESPONSIBILITY_IDS, type ChoiceId, type ResponsibilityId } from './ids';
import type { EconomyState, ReadonlyRun } from './types';

/** Keep repeated 100 ms fractional increments from drifting below exact prices. */
export function roundAmount(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function upgradeLevel(run: ReadonlyRun, id: UpgradeDefinition['id']): number {
  return run.upgradeLevels[id] ?? 0;
}

export function upgradePrice(definition: UpgradeDefinition, level: number): number {
  return roundAmount(definition.basePrice * definition.priceGrowth ** level);
}

export interface DerivedRates {
  /** Output queued by one accepted manual action. */
  readonly manualOutput: number;
  readonly passiveOutputPerSecond: number;
  readonly agents: number;
  readonly compute: number;
  readonly workPerAgentPerSecond: number;
  readonly tokenSupplyPerSecond: number;
  readonly tokenCostPerWork: number;
  /** Agent-seconds of work queued by one PROMPT. */
  readonly tasksPerPrompt: number;
  readonly passiveTasksPerSecond: number;
  readonly taskEfficiency: number;
  readonly debtPerUncheckedWork: number;
  readonly uncheckedFraction: number;
  readonly reviewPerSecond: number;
  readonly managed: number;
  /** Useful-output multiplier: 1 + permanent efficiency + temporary OPTIMIZE boost. */
  readonly efficiency: number;
  /** Experience from earlier runs: every source of code yields this much more (0.1 = +10 %). */
  readonly experience: number;
  readonly monetization: number;
  readonly operatingCostPerAgent: number;
  /** Fixed operating cost per second committed by choices (e.g. a loss-making expansion). */
  readonly fixedOverheadPerSecond: number;
  readonly automated: ReadonlySet<ResponsibilityId>;
  /** Tokens one unit of code buys (base × reviews × auto-reviewer). */
  readonly tokensPerCode: number;
  /** Owned auto-refill version (0 = none; the highest wins). */
  readonly autoRefill: 0 | 1 | 2;
  readonly autoReview: boolean;
  /** The company exists (Product Management): its credit line and interest apply. */
  readonly company: boolean;
}

/** Quality efficiency from debt, with a positive floor. */
export function qualityEfficiency(debt: number): number {
  return Math.max(QUALITY_FLOOR, 1 / (1 + debt / 100));
}

/** Debt and over-hiring hurt, but never below these (economy redesign E2: softer cliffs). */
export const QUALITY_FLOOR = 0.35;
export const COORDINATION_FLOOR = 0.4;

/** Coordination efficiency with a positive floor. */
export function coordinationEfficiency(managed: number, agents: number): number {
  return Math.max(COORDINATION_FLOOR, Math.min(1, managed / Math.max(1, agents)));
}

/** Every effect that currently applies: owned technologies plus per-level upgrade effects. */
export function activeEffects(run: ReadonlyRun, catalog: Catalog): Effect[] {
  const effects: Effect[] = [];
  for (const technology of catalog.technologies) {
    if (run.unlockedTechnologyIds.includes(technology.id)) effects.push(...technology.effects);
  }
  for (const upgrade of catalog.upgrades) {
    const level = upgradeLevel(run, upgrade.id);
    for (let i = 0; i < level; i += 1) effects.push(...upgrade.effectsPerLevel);
  }
  return effects;
}

/** Fixed overheads committed by choices, minus those a later choice cancelled. */
function fixedOverhead(run: ReadonlyRun, catalog: Catalog): number {
  const cancelled = new Set<ChoiceId>(
    catalog.choices.flatMap((c) => (c.cancels && run.choices[c.id] ? [c.cancels] : [])),
  );
  return Object.entries(run.choices).reduce(
    (sum, [id, c]) => sum + (cancelled.has(id as ChoiceId) ? 0 : (c?.overhead ?? 0)),
    0,
  );
}

/** The most the bank lends at these costs (credit line while running at a loss). */
export function creditLimit(costPerSecond: number, balance: BalanceDefinition): number {
  return Math.max(0, costPerSecond) * balance.money.creditSeconds;
}

/** Rates are recomputed from definitions on demand, never stored as stacked multipliers. */
export function deriveRates(run: ReadonlyRun, catalog: Catalog): DerivedRates {
  const { balance } = catalog;
  let manualOutput = balance.manualOutputPerAction;
  let passiveOutputPerSecond = 0;
  let agents = 0;
  let compute = 0;
  let workPerAgentPerSecond = 0;
  let tokenSupplyPerSecond = 0;
  let tokenCost = 0;
  let tokenCostMultiplier = 1;
  let tasksPerPrompt = 0;
  let passiveTasksPerSecond = 0;
  let taskEfficiency = 1;
  let debtPerUncheckedWork = 0;
  let uncheckedFraction = 1;
  let reviewPerSecond = 0;
  let managed = balance.coordination.baseManaged + run.economy.delegation;
  let efficiency = 1 + run.economy.optimization;
  let monetization = 0;
  let monetizationMultiplier = 1;
  let operatingCostPerAgent = 0;
  let autoRefill: 0 | 1 | 2 = 0;
  let autoReview = false;
  const automated = new Set<ResponsibilityId>();
  for (const effect of activeEffects(run, catalog)) {
    switch (effect.kind) {
      case 'manualOutput':
        manualOutput += effect.amount;
        break;
      case 'passiveOutputPerSecond':
        passiveOutputPerSecond += effect.amount;
        break;
      case 'agents':
        agents += effect.amount;
        break;
      case 'compute':
        compute += effect.amount;
        break;
      case 'workPerAgentPerSecond':
        workPerAgentPerSecond += effect.amount;
        break;
      case 'tokenSupplyPerSecond':
        tokenSupplyPerSecond += effect.amount;
        break;
      case 'tokenCostPerWork':
        tokenCost += effect.amount;
        break;
      case 'tokenCostMultiplier':
        tokenCostMultiplier *= effect.amount;
        break;
      case 'tasksPerPrompt':
        tasksPerPrompt += effect.amount;
        break;
      case 'passiveTasksPerSecond':
        passiveTasksPerSecond += effect.amount;
        break;
      case 'taskEfficiencyMultiplier':
        taskEfficiency *= effect.amount;
        break;
      case 'debtPerUncheckedWork':
        debtPerUncheckedWork += effect.amount;
        break;
      case 'uncheckedFractionMultiplier':
        uncheckedFraction *= effect.amount;
        break;
      case 'reviewPerSecond':
        reviewPerSecond += effect.amount;
        break;
      case 'managedCapacity':
        managed += effect.amount;
        break;
      case 'efficiency':
        efficiency += effect.amount;
        break;
      case 'automates':
        automated.add(effect.responsibility);
        break;
      case 'monetization':
        monetization += effect.amount;
        break;
      case 'monetizationMultiplier':
        monetizationMultiplier *= effect.amount;
        break;
      case 'operatingCostPerAgent':
        operatingCostPerAgent += effect.amount;
        break;
      case 'grantTokens':
        break;
      case 'autoRefill':
        autoRefill = effect.version > autoRefill ? effect.version : autoRefill;
        break;
      case 'autoReview':
        autoReview = true;
        break;
      default: {
        const unknown: never = effect;
        void unknown;
      }
    }
  }
  return {
    // Experience from earlier runs multiplies every source of code.
    manualOutput: manualOutput * (1 + run.experience),
    passiveOutputPerSecond: passiveOutputPerSecond * (1 + run.experience),
    experience: run.experience,
    agents,
    compute,
    workPerAgentPerSecond,
    tokenSupplyPerSecond,
    tokenCostPerWork:
      tokenCost > 0 ? Math.max(balance.minTokenCostPerWork, tokenCost * tokenCostMultiplier) : 0,
    tasksPerPrompt,
    passiveTasksPerSecond,
    taskEfficiency,
    debtPerUncheckedWork,
    uncheckedFraction,
    reviewPerSecond,
    managed,
    efficiency,
    monetization: monetization * monetizationMultiplier,
    operatingCostPerAgent,
    fixedOverheadPerSecond: fixedOverhead(run, catalog),
    automated,
    tokensPerCode: balance.tokens.perCodeBase * (1 + run.economy.tokenReviewBonus),
    autoRefill,
    autoReview,
    company: run.unlockedTechnologyIds.includes('product-management'),
  };
}

/** Tokens per second the current agents would burn at full capacity. */
export function tokenDemandPerSecond(rates: DerivedRates): number {
  return (
    Math.min(rates.agents, rates.compute) * rates.workPerAgentPerSecond * rates.tokenCostPerWork
  );
}

/** Two significant digits, so packs read as round numbers (6 480 → 6 500). */
export function roundNice(value: number): number {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.round(value / magnitude) * magnitude;
}

/**
 * One token pack: about `packSeconds` of current agent demand (never below `packMin`), priced
 * at the current tokens-per-code rate. Sizing follows the stage, so a pack is never trivial or
 * out of reach; better rates make every later pack cheaper.
 */
export function tokenPack(run: ReadonlyRun, catalog: Catalog): { tokens: number; price: number } {
  const rates = deriveRates(run, catalog);
  const { packMin, packSeconds } = catalog.balance.tokens;
  const tokens = Math.max(packMin, roundNice(tokenDemandPerSecond(rates) * packSeconds));
  return { tokens, price: Math.ceil(tokens / rates.tokensPerCode) };
}

/** The gig market: money per line of code in the current era (docs/feature_money.md §5.3). */
export function marketEra(run: ReadonlyRun, catalog: Catalog): number {
  let era = 0;
  catalog.money.eras.forEach((e, i) => {
    if (e.from === null || run.unlockedTechnologyIds.includes(e.from)) era = i;
  });
  return era;
}

export function marketRate(run: ReadonlyRun, catalog: Catalog): number {
  return catalog.money.eras[marketEra(run, catalog)]?.rate ?? 0;
}

/**
 * The price shown and charged for an offer at its current level, in the card's currency.
 * Market-priced cards (tokens, compute) are worth their code price at the current market rate.
 */
export function offerPrice(run: ReadonlyRun, upgrade: UpgradeDefinition, catalog: Catalog): number {
  const code = codePrice(run, upgrade, catalog);
  if (!upgrade.marketPriced) return code;
  const markup = upgrade.pack === 'tokens' ? catalog.balance.gigs.tokenMarkup : 1;
  return Math.max(1, roundNice(code * marketRate(run, catalog) * markup));
}

/** What an offer is worth in code (its own price, or what a market-priced card replaces). */
export function codePrice(run: ReadonlyRun, upgrade: UpgradeDefinition, catalog: Catalog): number {
  if (upgrade.pack === 'tokens') return tokenPack(run, catalog).price;
  if (upgrade.priceRule) {
    return roundNice(
      Math.max(
        upgradePrice(upgrade, upgradeLevel(run, upgrade.id)),
        upgrade.priceRule.paybackSeconds * usefulPerAgentPerSecond(run, catalog),
      ),
    );
  }
  return upgradePrice(upgrade, upgradeLevel(run, upgrade.id));
}

/** One runnable agent's useful code per second at the current balances (0 with no agents). */
function usefulPerAgentPerSecond(run: ReadonlyRun, catalog: Catalog): number {
  const dt = 0.1;
  const flows = economyFlows(run.economy, deriveRates(run, catalog), dt, catalog.balance);
  return flows.useful / dt / Math.max(1, flows.runnable);
}

/** Share of manual responsibilities now handled by the system (0–1). */
export function automationFraction(run: ReadonlyRun, catalog: Catalog): number {
  return deriveRates(run, catalog).automated.size / RESPONSIBILITY_IDS.length;
}

export interface EconomyStep {
  readonly economy: EconomyState;
  /** Output added this step (manual + passive + useful agent work). */
  readonly produced: number;
  /** The manual part of `produced` (it goes to the first build slot). */
  readonly manual: number;
}

/**
 * One fixed economy step (architecture §5). Manual work is free; agent work is limited by
 * active agents (compute), queued tasks, funded tokens and — once operating costs exist — by
 * the revenue that can pay for running them. Coordination, quality and efficiency scale the
 * useful part; unchecked work becomes debt; review removes it. Balances stay finite and ≥ 0.
 */
/** The intermediate quantities of one economy step (shared by the step and the Setup view). */
export interface EconomyFlows {
  /** Agents that have compute to run on. */
  readonly runnable: number;
  /** Runnable agents whose operating costs are paid. */
  readonly activeAgents: number;
  readonly costRate: number;
  readonly supplied: number;
  /** Work the active agents could do this step. */
  readonly demand: number;
  readonly workPerTask: number;
  readonly queued: number;
  /** Work the queued tasks allow. */
  readonly taskLimited: number;
  /** Work the tokens actually pay for. */
  readonly funded: number;
  readonly usedTasks: number;
  readonly unchecked: number;
  readonly debtAdded: number;
  readonly debtReviewed: number;
  readonly coordination: number;
  readonly quality: number;
  readonly useful: number;
  readonly earned: number;
  readonly spent: number;
  /** How far into the red the bank lets the money go at these costs. */
  readonly creditLimit: number;
  /** Interest on the money owed this step. */
  readonly interest: number;
}

export function economyFlows(
  economy: EconomyState,
  rates: DerivedRates,
  dt: number,
  balance: BalanceDefinition,
): EconomyFlows {
  const runnable = Math.min(rates.agents, rates.compute);
  // Operating costs are paid from the bank, then from the credit line; beyond it, unfunded
  // capacity idles.
  const costRate = runnable * rates.operatingCostPerAgent + rates.fixedOverheadPerSecond;
  const credit = creditLimit(costRate, balance);
  const affordable =
    costRate > 0
      ? Math.min(1, (economy.money + economy.revenuePerSecond * dt + credit) / (costRate * dt))
      : 1;
  const activeAgents = runnable * Math.max(0, affordable);
  const supplied = economy.tokens + rates.tokenSupplyPerSecond * dt;
  const demand = activeAgents * rates.workPerAgentPerSecond * dt;
  const workPerTask = rates.workPerAgentPerSecond * rates.taskEfficiency;
  const queued = Math.min(
    balance.agents.taskQueueCap,
    economy.tasks + rates.passiveTasksPerSecond * dt,
  );
  const taskLimited = Math.min(demand, queued * workPerTask);
  const funded =
    rates.tokenCostPerWork > 0
      ? Math.min(taskLimited, supplied / rates.tokenCostPerWork)
      : taskLimited;
  const usedTasks = workPerTask > 0 ? funded / workPerTask : 0;
  // Unchecked work is counted from funded work before quality penalties; manual work is free.
  const unchecked = funded * rates.uncheckedFraction;
  const coordination = coordinationEfficiency(rates.managed, Math.max(1, activeAgents));
  const quality = qualityEfficiency(economy.debt);
  const useful = funded * coordination * quality * rates.efficiency * (1 + rates.experience);
  return {
    runnable,
    activeAgents,
    costRate,
    supplied,
    demand,
    workPerTask,
    queued,
    taskLimited,
    funded,
    usedTasks,
    unchecked,
    debtAdded: unchecked * rates.debtPerUncheckedWork,
    debtReviewed: rates.reviewPerSecond * dt,
    coordination,
    quality,
    useful,
    earned: useful * rates.monetization,
    spent: costRate * Math.max(0, affordable) * dt,
    creditLimit: credit,
    // Only the company's bank charges interest; personal debt is the landlord's problem.
    interest: rates.company
      ? Math.max(0, -economy.money) * balance.money.interestPerSecond * dt
      : 0,
  };
}

export function stepEconomy(
  economy: EconomyState,
  rates: DerivedRates,
  stepMs: number,
  balance: BalanceDefinition,
): EconomyStep {
  const dt = stepMs / 1000;
  const f = economyFlows(economy, rates, dt, balance);
  const { supplied, funded, usedTasks, queued, useful, earned, spent, costRate } = f;
  const debt = Math.max(0, economy.debt + f.debtAdded - f.debtReviewed);
  const reserve =
    balance.agents.tokenReserve +
    rates.tokenSupplyPerSecond * balance.agents.tokenReserveSupplySeconds;
  const tokens = Math.min(
    Math.max(0, supplied - funded * rates.tokenCostPerWork),
    Math.max(reserve, economy.tokens),
  );
  const produced = roundAmount(
    economy.pendingManualWork + rates.passiveOutputPerSecond * dt + useful,
  );
  return {
    produced,
    manual: roundAmount(Math.min(produced, economy.pendingManualWork)),
    economy: {
      ...economy,
      // Smoothed code per second (what the cards' ETAs, gig sizes and salaries read).
      codeRate: roundAmount(
        economy.codeRate +
          (produced / dt - economy.codeRate) * Math.min(1, dt / balance.projects.codeRateSeconds),
      ),
      pendingManualWork: 0,
      tokens: roundAmount(tokens),
      tasks: roundAmount(Math.max(0, queued - usedTasks)),
      actionCharges: Math.min(
        balance.actionBurst,
        economy.actionCharges + balance.actionRefillPerSecond * dt,
      ),
      debt: roundAmount(debt),
      delegation: Math.max(
        0,
        roundAmount(economy.delegation - balance.coordination.delegationDecayPerSecond * dt),
      ),
      optimization: Math.max(
        0,
        roundAmount(economy.optimization - balance.optimizeDecayPerSecond * dt),
      ),
      // Operating costs never borrow past the credit line; debt from rent or food stays as it is.
      money: roundAmount(
        Math.max(
          Math.min(economy.money, -f.creditLimit),
          economy.money + earned - spent - f.interest,
        ),
      ),
      revenuePerSecond: roundAmount(earned / dt),
      // Costs owed, even when only part could be paid: the margin shows the real loss.
      costPerSecond: roundAmount(costRate),
      tokenDemandPerSecond: roundAmount(tokenDemandPerSecond(rates)),
    },
  };
}
