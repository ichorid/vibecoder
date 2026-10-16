import type { BalanceDefinition, Catalog, Effect, UpgradeDefinition } from './catalog';
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
}

/** Coordination efficiency with a positive floor. */
export function coordinationEfficiency(managed: number, agents: number): number {
  return Math.max(0.2, Math.min(1, managed / Math.max(1, agents)));
}

/** Quality efficiency from debt, with a positive floor. */
export function qualityEfficiency(debt: number): number {
  return Math.max(0.2, 1 / (1 + debt / 100));
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
  let manualOutput = catalog.balance.manualOutputPerAction;
  let passiveOutputPerSecond = 0;
  let agents = 0;
  let compute = 0;
  let workPerAgentPerSecond = 0;
  let tokenSupplyPerSecond = 0;
  let tokenCostPerWork = 0;
  let tasksPerPrompt = 0;
  let passiveTasksPerSecond = 0;
  let taskEfficiency = 1;
  let debtPerUncheckedWork = 0;
  let uncheckedFraction = 1;
  let reviewPerSecond = 0;
  let managed = catalog.balance.coordination.baseManaged + run.economy.delegation;
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
        tokenCostPerWork += effect.amount;
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
      case 'grantTokens':
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
    tokenCostPerWork,
    tasksPerPrompt,
    passiveTasksPerSecond,
    taskEfficiency,
    debtPerUncheckedWork,
    uncheckedFraction,
    reviewPerSecond,
    managed,
  };
}

export interface EconomyStep {
  readonly economy: EconomyState;
  /** Output added this step (manual + passive + useful agent work). */
  readonly produced: number;
}

/**
 * One fixed economy step (architecture §5): free manual work, passive output, and agent work
 * limited by active agents (compute), queued tasks and funded tokens. Unfunded capacity idles;
 * balances stay finite and nonnegative.
 */
export function stepEconomy(
  economy: EconomyState,
  rates: DerivedRates,
  stepMs: number,
  balance: BalanceDefinition,
): EconomyStep {
  const dt = stepMs / 1000;
  const supplied = economy.tokens + rates.tokenSupplyPerSecond * dt;
  const activeAgents = Math.min(rates.agents, rates.compute);
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
    funded * coordinationEfficiency(rates.managed, activeAgents) * qualityEfficiency(economy.debt);
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
      debt: roundAmount(debt),
      delegation: Math.max(
        0,
        roundAmount(economy.delegation - balance.coordination.delegationDecayPerSecond * dt),
      ),
      actionCharges: Math.min(
        balance.actionBurst,
        economy.actionCharges + balance.actionRefillPerSecond * dt,
      ),
    },
  };
}
