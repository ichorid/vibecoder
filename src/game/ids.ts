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
] as const;
export type TechnologyId = (typeof TECHNOLOGY_IDS)[number];

export const UPGRADE_IDS = [
  'autocomplete',
  'generated-snippets',
  'ai-native-ide',
  'terminal-agent',
  'token-supply',
  'compute-slot',
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
] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];

export const PRIMARY_ACTION_IDS = ['writeCode', 'prompt', 'delegate', 'supervise'] as const;
export type PrimaryActionId = (typeof PRIMARY_ACTION_IDS)[number];

export function isTechnologyId(value: unknown): value is TechnologyId {
  return typeof value === 'string' && (TECHNOLOGY_IDS as readonly string[]).includes(value);
}

export function isUpgradeId(value: unknown): value is UpgradeId {
  return typeof value === 'string' && (UPGRADE_IDS as readonly string[]).includes(value);
}
