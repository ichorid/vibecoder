import type { BalanceDefinition, Catalog, Effect, UpgradeDefinition } from './catalog';
import { RESPONSIBILITY_IDS, type ResponsibilityId } from './ids';
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
}

/** Quality efficiency from debt, with a positive floor. */
export function qualityEfficiency(debt: number): number {
  return Math.max(0.2, 1 / (1 + debt / 100));
}

/** Coordination efficiency with a positive floor. */
export function coordinationEfficiency(managed: number, agents: number): number {
  return Math.max(0.2, Math.min(1, managed / Math.max(1, agents)));
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
  let tokenRateBonus = 0;
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
      case 'tokensPerCodeBonus':
        tokenRateBonus += effect.amount;
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
    manualOutput,
    passiveOutputPerSecond,
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
    fixedOverheadPerSecond: Object.values(run.choices).reduce(
      (sum, c) => sum + (c?.overhead ?? 0),
      0,
    ),
    automated,
    tokensPerCode: balance.tokens.perCodeBase * (1 + tokenRateBonus + run.economy.tokenReviewBonus),
    autoRefill,
    autoReview,
  };
}

/** Tokens per second the current agents would burn at full capacity. */
export function tokenDemandPerSecond(rates: DerivedRates): number {
  return (
    Math.min(rates.agents, rates.compute) * rates.workPerAgentPerSecond * rates.tokenCostPerWork
  );
}

/** Two significant digits, so packs read as round numbers (6 480 → 6 500). */
function roundNice(value: number): number {
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

/** The price shown and charged for an offer at its current level. */
export function offerPrice(run: ReadonlyRun, upgrade: UpgradeDefinition, catalog: Catalog): number {
  return upgrade.pack === 'tokens'
    ? tokenPack(run, catalog).price
    : upgradePrice(upgrade, upgradeLevel(run, upgrade.id));
}

/** Share of manual responsibilities now handled by the system (0–1). */
export function automationFraction(run: ReadonlyRun, catalog: Catalog): number {
  return deriveRates(run, catalog).automated.size / RESPONSIBILITY_IDS.length;
}

export interface EconomyStep {
  readonly economy: EconomyState;
  /** Output added this step (manual + passive + useful agent work). */
  readonly produced: number;
}

/**
 * One fixed economy step (architecture §5). Manual work is free; agent work is limited by
 * active agents (compute), queued tasks, funded tokens and — once operating costs exist — by
 * the revenue that can pay for running them. Coordination, quality and efficiency scale the
 * useful part; unchecked work becomes debt; review removes it. Balances stay finite and ≥ 0.
 */
export function stepEconomy(
  economy: EconomyState,
  rates: DerivedRates,
  stepMs: number,
  balance: BalanceDefinition,
): EconomyStep {
  const dt = stepMs / 1000;
  const agents = Math.min(rates.agents, rates.compute);
  // Operating costs: unfunded capacity idles instead of driving revenue negative.
  const costRate = agents * rates.operatingCostPerAgent + rates.fixedOverheadPerSecond;
  const affordable =
    costRate > 0
      ? Math.min(1, (economy.revenue + economy.revenuePerSecond * dt) / (costRate * dt))
      : 1;
  const activeAgents = agents * Math.max(0, affordable);
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
  const debt = Math.max(
    0,
    economy.debt + unchecked * rates.debtPerUncheckedWork - rates.reviewPerSecond * dt,
  );
  const useful =
    funded *
    coordinationEfficiency(rates.managed, Math.max(1, activeAgents)) *
    qualityEfficiency(economy.debt) *
    rates.efficiency;
  const earned = useful * rates.monetization;
  const spent = costRate * Math.max(0, affordable) * dt;
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
    economy: {
      ...economy,
      output: roundAmount(economy.output + produced),
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
      revenue: roundAmount(Math.max(0, economy.revenue + earned - spent)),
      revenuePerSecond: roundAmount(earned / dt),
      // Costs owed, even when only part could be paid: the margin shows the real loss.
      costPerSecond: roundAmount(costRate),
      tokenDemandPerSecond: roundAmount(tokenDemandPerSecond(rates)),
    },
  };
}
