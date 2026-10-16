/**
 * Short "what this card does" lines, generated from the same effect definitions the economy
 * uses, so the explanation can never drift from the rules.
 */
import type { Catalog, Effect, UpgradeDefinition } from './catalog';

const num = (n: number) => String(Number(n.toFixed(2)));
const pct = (n: number) => `${Number((n * 100).toFixed(1))}%`;
const plural = (n: number, word: string) => `${num(n)} ${word}${n === 1 ? '' : 's'}`;

const RESPONSIBILITY: Record<string, string> = {
  writing: 'writing code',
  prompting: 'prompting',
  delegating: 'delegating',
  supervising: 'supervising',
  optimizing: 'optimizing',
  deciding: 'deciding',
};

export function effectText(effect: Effect, catalog: Catalog): string | null {
  const t = catalog.balance.tokens;
  switch (effect.kind) {
    case 'manualOutput':
      return `+${num(effect.amount)} code per press`;
    case 'passiveOutputPerSecond':
      return `+${num(effect.amount)} code/s`;
    case 'agents':
      return `+${plural(effect.amount, 'agent')}`;
    case 'compute':
      return `+${num(effect.amount)} compute`;
    case 'workPerAgentPerSecond':
      return `+${num(effect.amount)} work/s per agent`;
    case 'tokenSupplyPerSecond':
      return `+${num(effect.amount)} tokens/s`;
    case 'tokenCostPerWork':
      return `work costs ${plural(effect.amount, 'token')}`;
    case 'tasksPerPrompt':
      return `PROMPT queues ${plural(effect.amount, 'task')}`;
    case 'passiveTasksPerSecond':
      return `+${num(effect.amount)} tasks/s`;
    case 'taskEfficiencyMultiplier':
      return `each task ×${num(effect.amount)} work`;
    case 'debtPerUncheckedWork':
      return '+debt from unchecked work';
    case 'uncheckedFractionMultiplier':
      return `unchecked work ×${num(effect.amount)}`;
    case 'reviewPerSecond':
      return `−${num(effect.amount)} debt/s`;
    case 'managedCapacity':
      return `+${num(effect.amount)} managed`;
    case 'tokenCostMultiplier':
      return `token cost ×${num(effect.amount)}`;
    case 'efficiency':
      return `+${pct(effect.amount)} useful code`;
    case 'automates':
      return `automates ${RESPONSIBILITY[effect.responsibility] ?? effect.responsibility}`;
    case 'monetization':
      return `earns $${num(effect.amount)} per code`;
    case 'monetizationMultiplier':
      return `revenue ×${num(effect.amount)}`;
    case 'operatingCostPerAgent':
      return `each agent costs $${num(effect.amount)}/s`;
    case 'grantTokens':
      return `+${num(effect.amount)} tokens now`;
    case 'tokensPerCodeBonus':
      return `+${pct(effect.amount)} tokens per code`;
    case 'autoRefill':
      return 'buys tokens when they run out';
    case 'autoReview':
      return `+${pct(t.autoReviewStep)} tokens per code every ${num(t.autoReviewEveryMs / 1000)} s (up to +${pct(t.autoReviewCap)})`;
    default: {
      const unknown: never = effect;
      void unknown;
      return null;
    }
  }
}

/** The effect line of a card: its per-level effects, or the technology it unlocks. */
export function cardEffects(upgrade: UpgradeDefinition, catalog: Catalog): string[] {
  const technology = upgrade.discovers
    ? catalog.technologies.find((t) => t.id === upgrade.discovers)
    : undefined;
  const effects = technology ? technology.effects : upgrade.effectsPerLevel;
  const lines = effects
    .filter((e) => e.kind !== 'automates')
    .map((e) => effectText(e, catalog))
    .filter((line): line is string => line !== null);
  if (technology?.primaryAction) {
    lines.push(`action → ${catalog.primaryActionLabels[technology.primaryAction]}`);
  }
  if (upgrade.effectsPerLevel.some((e) => e.kind === 'autoRefill' && e.version === 1)) {
    lines.push('has a bug');
  }
  return lines;
}
