import type { TechnologyDefinition } from '../game/catalog';

export const technologies = [
  {
    id: 'autocomplete',
    prerequisites: [],
    title: 'Autocomplete',
    description: 'A grey ghost of code follows your cursor. You press Tab. You feel productive.',
    illustrationId: 'tech-autocomplete',
    worldAdditionId: 'world-autocomplete',
    effects: [{ kind: 'manualOutput', amount: 1 }],
  },
  {
    id: 'generated-snippets',
    prerequisites: ['autocomplete'],
    title: 'Generated Snippets',
    description: 'Describe a function; receive a function. Describing is the new typing.',
    illustrationId: 'tech-generated-snippets',
    worldAdditionId: 'world-generated-snippets',
    effects: [{ kind: 'manualOutput', amount: 2 }],
  },
  {
    id: 'ai-native-ide',
    prerequisites: ['generated-snippets'],
    title: 'AI-Native IDE',
    description: 'The editor now writes code on its own. You are promoted to prompter.',
    illustrationId: 'tech-ai-native-ide',
    worldAdditionId: 'world-ai-native-ide',
    primaryAction: 'prompt',
    effects: [{ kind: 'passiveOutputPerSecond', amount: 1 }],
  },
  {
    id: 'terminal-agent',
    prerequisites: ['ai-native-ide'],
    title: 'Terminal Agent',
    description:
      'A process in your terminal that writes code if you ask nicely and pay in tokens. It is always hungry.',
    illustrationId: 'tech-terminal-agent',
    worldAdditionId: 'world-terminal-agent',
    effects: [
      { kind: 'agents', amount: 1 },
      { kind: 'compute', amount: 1 },
      { kind: 'workPerAgentPerSecond', amount: 6 },
      { kind: 'tokenCostPerWork', amount: 1 },
      { kind: 'tokenSupplyPerSecond', amount: 4 },
      { kind: 'tasksPerPrompt', amount: 12 },
      { kind: 'grantTokens', amount: 150 },
    ],
    headerStats: ['output', 'tokens'],
  },
  {
    id: 'autonomous-edits',
    prerequisites: ['terminal-agent'],
    title: 'Autonomous Edits',
    description:
      'The agent now edits files on its own and runs a few tests first. Unchecked work leaves technical debt.',
    illustrationId: 'tech-autonomous-edits',
    worldAdditionId: 'world-autonomous-edits',
    effects: [
      { kind: 'workPerAgentPerSecond', amount: 6 },
      { kind: 'debtPerUncheckedWork', amount: 0.01 },
      { kind: 'uncheckedFractionMultiplier', amount: 0.5 },
      // The few tests it brings catch a little: a slow recovery path before the reviewer.
      { kind: 'reviewPerSecond', amount: 0.05 },
    ],
    headerStats: ['output', 'tokens', 'debt'],
  },
  {
    id: 'tool-permissions',
    prerequisites: ['autonomous-edits'],
    title: 'Tool Permissions',
    description:
      'No more “Allow this command?”. Each task now goes further. So does everything else.',
    illustrationId: 'tech-tool-permissions',
    worldAdditionId: 'world-tool-permissions',
    effects: [
      { kind: 'workPerAgentPerSecond', amount: 6 },
      { kind: 'taskEfficiencyMultiplier', amount: 1.5 },
    ],
  },
  {
    id: 'persistent-instructions',
    prerequisites: ['tool-permissions'],
    title: 'Persistent Instructions',
    description:
      'A file of rules the agent reads before every task. You will never write a prompt twice.',
    illustrationId: 'tech-persistent-instructions',
    worldAdditionId: 'world-persistent-instructions',
    effects: [
      { kind: 'passiveTasksPerSecond', amount: 1 },
      { kind: 'workPerAgentPerSecond', amount: 8 },
    ],
  },
  {
    id: 'ralph-loop',
    prerequisites: ['persistent-instructions'],
    title: 'Ralph Loop',
    description: 'while true; do agent; done. Tasks now refill themselves. So does the debt.',
    illustrationId: 'tech-ralph-loop',
    worldAdditionId: 'world-ralph-loop',
    effects: [
      { kind: 'passiveTasksPerSecond', amount: 3 },
      { kind: 'workPerAgentPerSecond', amount: 10 },
      { kind: 'debtPerUncheckedWork', amount: 0.01 },
    ],
  },
  {
    id: 'reviewer',
    prerequisites: ['ralph-loop'],
    title: 'Reviewer Agent',
    description: 'An agent that reviews agent code. It approved its own code twice already.',
    illustrationId: 'tech-reviewer',
    worldAdditionId: 'world-reviewer',
    effects: [{ kind: 'reviewPerSecond', amount: 0.5 }],
  },
  {
    id: 'parallel-agents',
    prerequisites: ['reviewer'],
    title: 'Parallel Agents',
    description:
      'Three agents at once. They work on the same file. You now DELEGATE more than you write.',
    illustrationId: 'tech-parallel-agents',
    worldAdditionId: 'world-parallel-agents',
    primaryAction: 'delegate',
    // The team plan comes with more tokens, and nobody to coordinate the team.
    effects: [
      { kind: 'agents', amount: 2 },
      { kind: 'tokenSupplyPerSecond', amount: 12 },
    ],
  },
  {
    id: 'worktrees',
    prerequisites: ['parallel-agents'],
    title: 'Worktrees',
    description:
      'Every agent works in its own branch of reality. Conflicts are postponed, not prevented.',
    illustrationId: 'tech-worktrees',
    worldAdditionId: 'world-worktrees',
    effects: [
      { kind: 'managedCapacity', amount: 1 },
      { kind: 'compute', amount: 1 },
    ],
  },
  {
    id: 'manager-agent',
    prerequisites: ['worktrees'],
    title: 'Manager Agent',
    description:
      'Your agents have a manager now. Delegation is automated; you SUPERVISE the manager.',
    illustrationId: 'tech-manager-agent',
    worldAdditionId: 'world-manager-agent',
    primaryAction: 'supervise',
    effects: [{ kind: 'managedCapacity', amount: 4 }],
  },
] as const satisfies readonly TechnologyDefinition[];
