import { readFileSync } from 'node:fs';
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

  it('rejects release windows whose odds do not sum to 20 % or whose prices fall', () => {
    const windows = catalog.releases.windows.map((w, i) =>
      i === 1 ? { ...w, jackpotWeight: 5, price: 1 } : w,
    );
    const text = messages(bundle({ releases: { ...catalog.releases, windows } }));
    expect(text).toMatch(/sum to 24.2/);
    expect(text).toMatch(/price does not increase/);
  });

  it('rejects long wheel labels and over-long comments', () => {
    const slices = catalog.releases.slices.map((s, i) =>
      i === 0 ? { ...s, label: 'MUCH TOO LONG' } : s,
    );
    const comments = [{ id: 'x', text: 'y'.repeat(141) }, ...catalog.releases.comments];
    const text = messages(bundle({ releases: { ...catalog.releases, slices, comments } }));
    expect(text).toMatch(/label must be 1–10/);
    expect(text).toMatch(/longer than 140/);
  });

  it('keeps the attribution header on the third-party comments file', () => {
    const source = readFileSync('src/content/releaseComments.ts', 'utf8');
    for (const needle of ['pyjokes', 'stackoverflow.com/questions/234075', 'CC BY-SA 3.0']) {
      expect(source).toContain(needle);
    }
  });

  it('rejects a technology with too little console chatter or a repeated line', () => {
    const chatter = { ...catalog.chatter, autocomplete: ['only one line'] };
    expect(messages(bundle({ chatter }))).toMatch(/chatter "autocomplete": 1 lines/);
    const twice = {
      ...catalog.chatter,
      reviewer: [
        ...(catalog.chatter.reviewer ?? []).slice(1),
        catalog.chatter.worktrees?.[0] ?? '',
      ],
    };
    expect(messages(bundle({ chatter: twice }))).toMatch(/used twice/);
  });
});
