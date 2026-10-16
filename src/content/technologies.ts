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
] as const satisfies readonly TechnologyDefinition[];
