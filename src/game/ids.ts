/**
 * Stable content ID tuples. Domain types derive literal unions from these so game code never
 * imports content implementations. Extend a tuple when content with that ID is introduced;
 * never rename a saved ID without an explicit migration mapping.
 */
export const TECHNOLOGY_IDS = [
  'autocomplete',
  'generated-snippets',
  'ai-native-ide',
  'terminal-agent',
  'autonomous-edits',
  'tool-permissions',
  'persistent-instructions',
  'ralph-loop',
  'reviewer',
  'parallel-agents',
  'worktrees',
  'manager-agent',
  'context-management',
  'persistent-memory',
  'model-routing',
  'token-optimization',
  'local-servers',
  'custom-harness',
  'meta-harness',
  'evaluations',
  'workflow-optimization',
  'self-improvement',
  'self-driving-repositories',
  'product-management',
  'marketing',
  'finance',
  'executive-agents',
  'autonomous-company',
] as const;
export type TechnologyId = (typeof TECHNOLOGY_IDS)[number];

export const UPGRADE_IDS = [
  'autocomplete',
  'generated-snippets',
  'ai-native-ide',
  'terminal-agent',
  'token-supply',
  'compute-slot',
  'auto-refill-v1',
  'auto-refill-v2',
  'token-review',
  'auto-reviewer',
  'autonomous-edits',
  'tool-permissions',
  'persistent-instructions',
  'ralph-loop',
  'reviewer',
  'review-capacity',
  'parallel-agents',
  'worktrees',
  'manager-agent',
  'additional-agent',
  'context-management',
  'persistent-memory',
  'model-routing',
  'token-optimization',
  'local-servers',
  'custom-harness',
  'meta-harness',
  'evaluations',
  'workflow-optimization',
  'self-improvement',
  'self-driving-repositories',
  'product-management',
  'marketing',
  'finance',
  'executive-agents',
  'autonomous-company',
] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];

export const PRIMARY_ACTION_IDS = [
  'writeCode',
  'prompt',
  'delegate',
  'supervise',
  'optimize',
  'observe',
] as const;
export type PrimaryActionId = (typeof PRIMARY_ACTION_IDS)[number];

/** Endings (IDs only; texts and conditions are content). */
export const ENDING_IDS = [
  'three-users',
  'the-last-programmer',
  'the-great-merge-conflict',
  'the-greenest-pipeline',
  'the-forgotten-project',
  'the-perfect-saas',
  'acquired-by-yourself',
  'fully-automated-bankruptcy',
  'the-human-approval-api',
  'you-have-been-optimized',
  'the-infinite-weekend',
] as const;
export type EndingId = (typeof ENDING_IDS)[number];

/** Player decisions offered as cards (some end the run, some commit a path). */
export const CHOICE_IDS = [
  'keep-manual',
  'finish-by-hand',
  'force-merge',
  'freeze-features',
  'archive-original',
  'small-saas',
  'self-acquisition',
  'expand-anyway',
  'close-company',
  'keep-approval',
  'remove-oversight',
] as const;
export type ChoiceId = (typeof CHOICE_IDS)[number];

/** Silly outcomes on the release wheel (the gold slice is `'jackpot'`, not a slice). */
export const RELEASE_OUTCOME_IDS = [
  'three-users',
  'one-star',
  'hacker-news',
  'product-hunt',
  'viral',
  'acquired',
  'cloud-bill',
  'pivot',
  'cat-review',
] as const;
export type ReleaseOutcomeId = (typeof RELEASE_OUTCOME_IDS)[number];

/** A release's number in the run (1 = v0.1). There is always a next one. */
export type ReleaseWindow = number;
/** Upper bound for validation of saved releases. */
export const MAX_RELEASES = 999;

/** Manual responsibilities that technologies progressively automate. */
export const RESPONSIBILITY_IDS = [
  'writing',
  'prompting',
  'delegating',
  'supervising',
  'optimizing',
  'deciding',
] as const;
export type ResponsibilityId = (typeof RESPONSIBILITY_IDS)[number];

export function isTechnologyId(value: unknown): value is TechnologyId {
  return typeof value === 'string' && (TECHNOLOGY_IDS as readonly string[]).includes(value);
}

export function isUpgradeId(value: unknown): value is UpgradeId {
  return typeof value === 'string' && (UPGRADE_IDS as readonly string[]).includes(value);
}
