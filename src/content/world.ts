/** Authored world additions around the original room at (0, 0). Geometry arrives in P06. */
export interface WorldAddition {
  readonly id: string;
}

export const worldAdditions = [
  { id: 'world-autocomplete' },
  { id: 'world-generated-snippets' },
  { id: 'world-ai-native-ide' },
] as const satisfies readonly WorldAddition[];
