/**
 * The "current setup" read model: everything applied so far (technologies, stacked upgrades)
 * and a per-second breakdown of the economy. The numbers come from `economyFlows`, the same
 * function the simulation step uses, so the screen explains exactly what the game does.
 */
import type { Catalog, Effect, UpgradeDefinition } from './catalog';
import { activeEffects, deriveRates, economyFlows, upgradeLevel } from './economy';
import { cardEffects, effectText } from './effectText';
import { creditState, type CreditState } from './money';
import type { PrimaryActionId, TechnologyId, UpgradeId } from './ids';
import { currentPrimaryAction } from './progression';
import type { ReadonlyRun } from './types';

/** What currently holds production back, most fundamental first. */
export type SetupLimit =
  'manual' | 'compute' | 'tasks' | 'tokens' | 'coordination' | 'debt' | 'costs';

export interface SetupViewModel {
  readonly technologies: readonly {
    readonly id: TechnologyId;
    readonly title: string;
    readonly illustrationId: string;
    readonly effects: readonly string[];
  }[];
  readonly stacked: readonly {
    readonly id: UpgradeId;
    readonly title: string;
    readonly level: number;
    readonly maxLevel: number;
    readonly effects: readonly string[];
  }[];
  readonly economy: {
    readonly action: string;
    readonly actionId: PrimaryActionId;
    /** What caps the agents' work right now (null before there are agents). */
    readonly limitedBy: 'compute' | 'agents' | 'tasks' | 'tokens' | null;
    /** What one press of the main button does right now. */
    readonly pressEffect: string;
    readonly agents: number;
    readonly compute: number;
    readonly runnableAgents: number;
    readonly activeAgents: number;
    readonly workPerAgentPerSecond: number;
    readonly potentialWorkPerSecond: number;
    readonly tasksQueued: number;
    readonly tasksPerSecond: number;
    readonly tasksPerPrompt: number;
    readonly workPerTask: number;
    readonly taskLimitedWorkPerSecond: number;
    readonly tokens: number;
    readonly tokenSupplyPerSecond: number;
    readonly tokenCostPerWork: number;
    readonly tokenUsePerSecond: number;
    /** Seconds until the tokens run out at the current net use (null: not draining). */
    readonly tokensLastSeconds: number | null;
    readonly tokensPerCode: number;
    readonly autoRefill: 0 | 1 | 2;
    readonly fundedWorkPerSecond: number;
    readonly managed: number;
    readonly coordination: number;
    readonly quality: number;
    readonly efficiency: number;
    /** Code yield from experience earned in earlier runs (0.2 = +20 %). */
    readonly experience: number;
    readonly usefulCodePerSecond: number;
    readonly passiveCodePerSecond: number;
    readonly totalCodePerSecond: number;
    readonly debt: number;
    readonly uncheckedShare: number;
    readonly debtAddedPerSecond: number;
    readonly debtReviewedPerSecond: number;
    /** Present once money matters (revenue or operating costs). */
    readonly money: {
      readonly revenue: number;
      /** $ earned per unit of useful code (base × marketing/finance/executive multipliers). */
      readonly perCode: number;
      readonly basePerCode: number;
      readonly usefulCodePerSecond: number;
      readonly runningAgents: number;
      readonly costPerAgent: number;
      /** Fixed costs from decisions (e.g. expanding into every market). */
      readonly overheadPerSecond: number;
      /** Borrowed money while costs exceed revenue (null in the black). */
      readonly credit: CreditState | null;
      readonly interestPerSecond: number;
      readonly revenuePerSecond: number;
      readonly costPerSecond: number;
      readonly marginPerSecond: number;
    } | null;
  };
  readonly limits: readonly SetupLimit[];
}

const MULTIPLIERS = new Set<Effect['kind']>([
  'taskEfficiencyMultiplier',
  'uncheckedFractionMultiplier',
  'tokenCostMultiplier',
  'monetizationMultiplier',
]);

/** The total effect of `level` copies of one per-level effect. */
function stacked(effect: Effect, level: number): Effect {
  if (!('amount' in effect)) return effect;
  const amount = MULTIPLIERS.has(effect.kind) ? effect.amount ** level : effect.amount * level;
  return { ...effect, amount };
}

/** Owned non-progression cards (repeatables and one-time tools such as auto-refill). */
function isStackable(upgrade: UpgradeDefinition): boolean {
  return !upgrade.discovers && !upgrade.pack;
}

const STEP_S = 0.1;

const fmt = (value: number) => String(Number(value.toFixed(2)));

function pressEffect(
  action: PrimaryActionId,
  rates: ReturnType<typeof deriveRates>,
  catalog: Catalog,
): string {
  const b = catalog.balance;
  switch (action) {
    case 'writeCode':
      return `+${fmt(rates.manualOutput)} code`;
    case 'prompt':
      return `+${fmt(rates.manualOutput)} code, +${fmt(rates.tasksPerPrompt)} tasks`;
    case 'delegate':
      return `+1 managed for a while (up to +${fmt(b.coordination.delegationCap)})`;
    case 'supervise':
      return `−${fmt(b.coordination.supervisePerPress)} debt`;
    case 'optimize':
      return `+${Math.round(b.optimizeStep * 100)}% efficiency for a while (up to +${Math.round(b.optimizeCap * 100)}%)`;
    case 'observe':
      return 'nothing (the company runs itself), +1 existential dread';
  }
}

export function selectSetup(run: ReadonlyRun, catalog: Catalog): SetupViewModel {
  const rates = deriveRates(run, catalog);
  const f = economyFlows(run.economy, rates, STEP_S, catalog.balance);
  const perSecond = (amount: number) => amount / STEP_S;
  const tokenUse = perSecond(f.funded * rates.tokenCostPerWork);
  const drain = tokenUse - rates.tokenSupplyPerSecond;
  const money =
    rates.monetization > 0 || f.costRate > 0
      ? {
          revenue: run.economy.revenue,
          perCode: rates.monetization,
          basePerCode: activeEffects(run, catalog)
            .filter((e) => e.kind === 'monetization')
            .reduce((sum, e) => sum + ('amount' in e ? e.amount : 0), 0),
          usefulCodePerSecond: perSecond(f.useful),
          runningAgents: f.runnable,
          costPerAgent: rates.operatingCostPerAgent,
          overheadPerSecond: rates.fixedOverheadPerSecond,
          credit: creditState(run, catalog),
          interestPerSecond: catalog.balance.money.interestPerSecond,
          revenuePerSecond: perSecond(f.earned),
          costPerSecond: f.costRate,
          marginPerSecond: perSecond(f.earned) - f.costRate,
        }
      : null;

  const limits: SetupLimit[] = [];
  if (rates.agents === 0) limits.push('manual');
  else {
    if (f.runnable < rates.agents) limits.push('compute');
    if (f.activeAgents < f.runnable) limits.push('costs');
    if (f.taskLimited < f.demand - 1e-9) limits.push('tasks');
    if (f.funded < f.taskLimited - 1e-9) limits.push('tokens');
    if (f.coordination < 1) limits.push('coordination');
    if (f.quality < 0.9) limits.push('debt');
  }

  return {
    technologies: run.unlockedTechnologyIds.flatMap((id) => {
      const technology = catalog.technologies.find((t) => t.id === id);
      const card = catalog.upgrades.find((u) => u.discovers === id);
      if (!technology) return [];
      return [
        {
          id,
          title: technology.title,
          illustrationId: technology.illustrationId,
          effects: card ? cardEffects(card, catalog) : [],
        },
      ];
    }),
    stacked: catalog.upgrades.flatMap((upgrade) => {
      const level = upgradeLevel(run, upgrade.id);
      if (!isStackable(upgrade) || level === 0) return [];
      const replaced = upgrade.id === 'auto-refill-v1' && upgradeLevel(run, 'auto-refill-v2') > 0;
      const effects = replaced
        ? ['replaced by v2']
        : upgrade.effectsPerLevel
            .map((e) => effectText(stacked(e, level), catalog))
            .filter((line): line is string => line !== null);
      return [{ id: upgrade.id, title: upgrade.title, level, maxLevel: upgrade.maxLevel, effects }];
    }),
    economy: {
      action: catalog.primaryActionLabels[currentPrimaryAction(run, catalog)],
      actionId: currentPrimaryAction(run, catalog),
      limitedBy:
        rates.agents === 0
          ? null
          : f.funded < f.taskLimited - 1e-9
            ? 'tokens'
            : f.taskLimited < f.demand - 1e-9
              ? 'tasks'
              : rates.compute < rates.agents
                ? 'compute'
                : 'agents',
      pressEffect: pressEffect(currentPrimaryAction(run, catalog), rates, catalog),
      agents: rates.agents,
      compute: rates.compute,
      runnableAgents: f.runnable,
      activeAgents: f.activeAgents,
      workPerAgentPerSecond: rates.workPerAgentPerSecond,
      potentialWorkPerSecond: perSecond(f.demand),
      tasksQueued: run.economy.tasks,
      tasksPerSecond: rates.passiveTasksPerSecond,
      tasksPerPrompt: rates.tasksPerPrompt,
      workPerTask: f.workPerTask,
      taskLimitedWorkPerSecond: perSecond(f.taskLimited),
      tokens: run.economy.tokens,
      tokenSupplyPerSecond: rates.tokenSupplyPerSecond,
      tokenCostPerWork: rates.tokenCostPerWork,
      tokenUsePerSecond: tokenUse,
      tokensLastSeconds: drain > 1e-9 ? run.economy.tokens / drain : null,
      tokensPerCode: rates.tokensPerCode,
      autoRefill: rates.autoRefill,
      fundedWorkPerSecond: perSecond(f.funded),
      managed: rates.managed,
      coordination: f.coordination,
      quality: f.quality,
      efficiency: rates.efficiency,
      experience: rates.experience,
      usefulCodePerSecond: perSecond(f.useful),
      passiveCodePerSecond: rates.passiveOutputPerSecond,
      totalCodePerSecond: perSecond(f.useful) + rates.passiveOutputPerSecond,
      debt: run.economy.debt,
      uncheckedShare: rates.debtPerUncheckedWork > 0 ? rates.uncheckedFraction : 0,
      debtAddedPerSecond: perSecond(f.debtAdded),
      debtReviewedPerSecond: rates.reviewPerSecond,
      money,
    },
    limits,
  };
}

/** Code/s and debt/s the economy produces right now (one step, scaled to a second). */
function rates(run: ReadonlyRun, catalog: Catalog): { code: number; debt: number } {
  const r = deriveRates(run, catalog);
  const f = economyFlows(run.economy, r, STEP_S, catalog.balance);
  return {
    code: f.useful / STEP_S + r.passiveOutputPerSecond,
    debt: (f.debtAdded - f.debtReviewed) / STEP_S,
  };
}

/**
 * What buying `upgrade` would change right now: the same economy computed with it owned
 * (a technology card: with its technology unlocked). Consumables (token packs) have none.
 */
export function upgradeImpact(
  run: ReadonlyRun,
  upgrade: UpgradeDefinition,
  catalog: Catalog,
): { readonly codePerSecond: number; readonly debtPerSecond: number } | null {
  if (upgrade.pack) return null;
  const level = upgradeLevel(run, upgrade.id);
  const bought: ReadonlyRun = {
    ...run,
    upgradeLevels: { ...run.upgradeLevels, [upgrade.id]: level + 1 },
    unlockedTechnologyIds:
      upgrade.discovers && !run.unlockedTechnologyIds.includes(upgrade.discovers)
        ? [...run.unlockedTechnologyIds, upgrade.discovers]
        : run.unlockedTechnologyIds,
  };
  const now = rates(run, catalog);
  const after = rates(bought, catalog);
  return { codePerSecond: after.code - now.code, debtPerSecond: after.debt - now.debt };
}
