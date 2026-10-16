import { describe, expect, it } from 'vitest';
import { assetManifest, type AssetManifest } from '../src/content/assets';
import { validateAssets, type AssetFiles } from './validateAssets';
import { nodeAssetFiles } from './assetFiles';

function fakeFiles(overrides: Partial<Record<string, string | null>> = {}): AssetFiles {
  const real = nodeAssetFiles('public/assets');
  return {
    readText: (file) => (file in overrides ? (overrides[file] ?? null) : real.readText(file)),
    pngSize: (file) => (file in overrides && overrides[file] === null ? null : real.pngSize(file)),
  };
}

const msgs = (manifest: AssetManifest, files: AssetFiles) =>
  validateAssets(manifest, files).join('\n');

describe('asset validation', () => {
  it('accepts the exported assets', () => {
    expect(validateAssets(assetManifest, nodeAssetFiles('public/assets'))).toEqual([]);
  });

  it('rejects a missing illustration file', () => {
    expect(msgs(assetManifest, fakeFiles({ 'technologies/autocomplete.png': null }))).toMatch(
      /technologies\/autocomplete.png/,
    );
  });

  it('rejects a missing animation tag', () => {
    const manifest = {
      ...assetManifest,
      requiredAnimations: [...assetManifest.requiredAnimations, 'cat-moonwalk'],
    };
    expect(msgs(manifest, nodeAssetFiles('public/assets'))).toMatch(/cat-moonwalk/);
  });

  it('rejects an atlas in the wrong format', () => {
    expect(
      msgs(
        assetManifest,
        fakeFiles({ 'sprites-dark.json': JSON.stringify({ frames: [], meta: {} }) }),
      ),
    ).toMatch(/format/);
  });

  it('rejects an unreadable atlas JSON', () => {
    expect(msgs(assetManifest, fakeFiles({ 'sprites-light.json': '{oops' }))).toMatch(/JSON/);
  });
});
