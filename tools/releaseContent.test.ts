import { describe, expect, it } from 'vitest';
import { assetManifest, type AssetManifest } from '../src/content/assets';
import { catalog } from '../src/content/catalog';
import { worldAdditions, type WorldAddition } from '../src/content/world';
import { nodeAssetFiles } from './assetFiles';
import { validateRelease, type ReleaseInput } from './validateRelease';

function input(overrides: Partial<ReleaseInput> = {}): ReleaseInput {
  return {
    catalog,
    assets: assetManifest,
    worldAdditions,
    files: nodeAssetFiles('public/assets'),
    requiredTechnologies: 28,
    ...overrides,
  };
}

const text = (overrides: Partial<ReleaseInput>) => validateRelease(input(overrides)).join('\n');

describe('release content check', () => {
  it('accepts the finished catalog with real art', () => {
    expect(validateRelease(input())).toEqual([]);
  });

  it('rejects placeholder art', () => {
    const assets: AssetManifest = {
      ...assetManifest,
      illustrations: assetManifest.illustrations.map((a, i) =>
        i === 0 ? { ...a, placeholder: true } : a,
      ),
    };
    expect(text({ assets })).toMatch(/placeholder/);
  });

  it('rejects one PNG reused under several names', () => {
    const [first] = assetManifest.illustrations;
    if (!first) throw new Error('none');
    const assets: AssetManifest = {
      ...assetManifest,
      illustrations: assetManifest.illustrations.map((a, i) =>
        i === 1 ? { ...a, file: first.file } : a,
      ),
    };
    expect(text({ assets })).toMatch(/identical|duplicate/);
  });

  it('rejects a missing memorial photo', () => {
    const assets: AssetManifest = {
      ...assetManifest,
      memorial: [assetManifest.memorial[0] ?? { id: 'x', file: 'x' }],
    };
    expect(text({ assets })).toMatch(/memorial/);
  });

  it('rejects a catalog with fewer than 28 technologies', () => {
    expect(text({ requiredTechnologies: 29 })).toMatch(/29/);
  });

  it('rejects a placement that uses an unknown atlas tag', () => {
    const broken = worldAdditions.map((a, i): WorldAddition =>
      i === 0 ? { ...a, placements: [...a.placements, { sprite: 'kit-unicorn', x: 0, y: 0 }] } : a,
    );
    expect(text({ worldAdditions: broken })).toMatch(/kit-unicorn/);
  });

  it('rejects a missing scene addition and a non-expanding envelope', () => {
    const missing = worldAdditions.filter((a) => a.technologyId !== 'worktrees');
    expect(text({ worldAdditions: missing })).toMatch(/worktrees/);
    const shrinking = worldAdditions.map((a, i): WorldAddition =>
      i === 5 ? { ...a, envelope: { x: -10, y: -10, w: 20, h: 20 } } : a,
    );
    expect(text({ worldAdditions: shrinking })).toMatch(/envelope/);
  });

  it('rejects placements outside their framing envelope', () => {
    const outside = worldAdditions.map((a, i): WorldAddition =>
      i === 2 ? { ...a, placements: [{ sprite: 'kit-node', x: 1e6, y: 0 }] } : a,
    );
    expect(text({ worldAdditions: outside })).toMatch(/outside/);
  });
});
