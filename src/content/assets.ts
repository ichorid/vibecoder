/**
 * Asset manifest: stable IDs → exported files. Entries marked `placeholder` are temporary
 * development art; the release content check (P08) rejects them.
 */
export interface IllustrationAsset {
  readonly id: string;
  readonly file: string;
  readonly placeholder: boolean;
}

export interface AssetManifest {
  readonly illustrations: readonly IllustrationAsset[];
}

export const assetManifest = {
  illustrations: [
    { id: 'tech-autocomplete', file: 'technologies/autocomplete.png', placeholder: true },
    {
      id: 'tech-generated-snippets',
      file: 'technologies/generated-snippets.png',
      placeholder: true,
    },
    { id: 'tech-ai-native-ide', file: 'technologies/ai-native-ide.png', placeholder: true },
  ],
} as const satisfies AssetManifest;
