import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../src/music/core/catalog';
import { canonicalJson, canonicalPayload } from '../../src/music/core/canonical';
import { contentHash, sha256Hex } from '../../src/music/hash';
import { arrangement, drums, motif, pattern, preset, sources } from './fixtures';

function first<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error('expected an item');
  return item;
}

function catalogWith(overrides: Parameters<typeof sources>[0] = {}) {
  const { catalog, diagnostics } = buildCatalog(
    sources({
      arrangements: [
        arrangement({
          roles: {
            lead: { preset: 'test-lead' },
            percussion: { preset: 'test-drums' },
            arp: { preset: 'test-arp', enabled: false },
          },
        }),
      ],
      presets: [preset(), drums(), preset({ id: 'test-arp', family: 'arp', polyphony: 3 })],
      ...overrides,
    }),
  );
  expect(diagnostics.filter((d) => d.level === 'error')).toEqual([]);
  return catalog;
}

const reversedKeys = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(reversedKeys)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .reverse()
            .map(([k, v]) => [k, reversedKeys(v)]),
        )
      : value;

describe('canonical payload and content hash', () => {
  it('serialises objects with sorted keys and keeps array order', () => {
    expect(canonicalJson({ b: [3, 1, { d: 1, c: 2 }], a: 'x' })).toBe(
      '{"a":"x","b":[3,1,{"c":2,"d":1}]}',
    );
    expect(() => canonicalJson({ a: Number.NaN })).toThrow();
  });

  it('is independent of object key order', async () => {
    const base = catalogWith();
    const reordered = catalogWith({ patterns: [reversedKeys(pattern())] });
    const [p1] = base.patterns;
    const [p2] = reordered.patterns;
    if (!p1 || !p2) throw new Error('fixture');
    expect(await contentHash(p1, base)).toBe(await contentHash(p2, reordered));
  });

  it('changes when a note, a used preset or the motif changes', async () => {
    const base = catalogWith();
    const [p] = base.patterns;
    if (!p) throw new Error('fixture');
    const original = await contentHash(p, base);

    const noteChanged = catalogWith({
      patterns: [
        pattern({ tracks: { lead: [{ type: 'note', step: 0, length: 4, pitch: 'F5' }] } }),
      ],
    });
    expect(await contentHash(first(noteChanged.patterns), noteChanged)).not.toBe(original);

    const presetChanged = catalogWith({
      presets: [
        preset({ level: 0.4 }),
        drums(),
        preset({ id: 'test-arp', family: 'arp', polyphony: 3 }),
      ],
    });
    expect(await contentHash(first(presetChanged.patterns), presetChanged)).not.toBe(original);

    const motifChanged = catalogWith({ motifs: [motif({ degrees: [1, 3, 5, 3] })] });
    expect(await contentHash(first(motifChanged.patterns), motifChanged)).not.toBe(original);
  });

  it('ignores unrelated material: other patterns, unused presets, descriptive metadata', async () => {
    const base = catalogWith();
    const original = await contentHash(first(base.patterns), base);

    const more = catalogWith({ patterns: [pattern(), pattern({ id: 'another' })] });
    expect(await contentHash(first(more.patterns), more)).toBe(original);

    const unusedPreset = catalogWith({
      presets: [preset(), drums(), preset({ id: 'test-arp', family: 'arp', polyphony: 2 })],
    });
    expect(await contentHash(first(unusedPreset.patterns), unusedPreset)).toBe(original);

    const described = catalogWith({
      patterns: [pattern({ metadata: { description: 'new words' } })],
    });
    expect(await contentHash(first(described.patterns), described)).toBe(original);
  });

  it('Web Crypto SHA-256 equals node:crypto over the same canonical bytes', async () => {
    const base = catalogWith();
    const text = canonicalPayload(first(base.patterns), base);
    expect(await sha256Hex(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
    expect(await sha256Hex('é✓')).toBe(createHash('sha256').update('é✓', 'utf8').digest('hex'));
  });
});
