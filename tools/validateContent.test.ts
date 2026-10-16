import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { assetManifest } from '../src/content/assets';
import { worldAdditions } from '../src/content/world';
import type { Catalog, TechnologyDefinition, UpgradeDefinition } from '../src/game/catalog';
import { validateContent, type ContentBundle } from './validateContent';

function bundle(
  overrides: Partial<Catalog> = {},
  rest: Partial<ContentBundle> = {},
): ContentBundle {
  return {
    catalog: { ...catalog, ...overrides },
    assets: assetManifest,
    worldAdditions,
    ...rest,
  };
}

const [first, second, third] = catalog.technologies;
const upgrades = catalog.upgrades;

function messages(input: ContentBundle): string {
  return validateContent(input)
    .map((issue) => issue.message)
    .join('\n');
}

describe('validateContent', () => {
  it('accepts the current three-technology catalog', () => {
    expect(validateContent(bundle())).toEqual([]);
  });

  it('rejects duplicate IDs', () => {
    expect(messages(bundle({ upgrades: [...upgrades, upgrades[0] as UpgradeDefinition] }))).toMatch(
      /duplicate upgrade id "autocomplete"/,
    );
  });

  it('rejects a missing prerequisite', () => {
    const broken = { ...second, prerequisites: ['nope'] } as unknown as TechnologyDefinition;
    expect(
      messages(bundle({ technologies: [first, broken, third] as TechnologyDefinition[] })),
    ).toMatch(/unknown prerequisite "nope"/);
  });

  it('rejects a cycle in required progression', () => {
    const looped = { ...first, prerequisites: ['ai-native-ide'] } as TechnologyDefinition;
    expect(
      messages(bundle({ technologies: [looped, second, third] as TechnologyDefinition[] })),
    ).toMatch(/cycle/);
  });

  it('rejects a negative or nonfinite price', () => {
    const bad = { ...upgrades[0], basePrice: -1 } as UpgradeDefinition;
    expect(messages(bundle({ upgrades: [bad, ...upgrades.slice(1)] }))).toMatch(/invalid price/);
  });

  it('rejects an unknown effect kind', () => {
    const odd = {
      ...first,
      effects: [{ kind: 'printMoney', amount: 1 }],
    } as unknown as TechnologyDefinition;
    expect(
      messages(bundle({ technologies: [odd, second, third] as TechnologyDefinition[] })),
    ).toMatch(/unknown effect kind "printMoney"/);
  });

  it('rejects a missing illustration or world addition', () => {
    expect(messages(bundle({}, { assets: { ...assetManifest, illustrations: [] } }))).toMatch(
      /missing illustration "tech-autocomplete"/,
    );
    expect(messages(bundle({}, { worldAdditions: [] }))).toMatch(
      /missing world addition "world-autocomplete"/,
    );
  });

  it('rejects an upgrade that discovers an unknown technology', () => {
    const bad = { ...upgrades[0], discovers: 'ghost' } as unknown as UpgradeDefinition;
    expect(messages(bundle({ upgrades: [bad, ...upgrades.slice(1)] }))).toMatch(
      /unknown technology "ghost"/,
    );
  });
});
