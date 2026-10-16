import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../src/music/core/catalog';
import { validateReview } from '../../src/music/core/review';
import { arrangement, era, pattern, preset, sources } from './fixtures';

const errors = (input: ReturnType<typeof sources>) =>
  buildCatalog(input)
    .diagnostics.filter((d) => d.level === 'error')
    .map((d) => d.message)
    .join('\n');

describe('music catalog contracts', () => {
  it('accepts a consistent catalog', () => {
    const { diagnostics, catalog } = buildCatalog(sources());
    expect(diagnostics.filter((d) => d.level === 'error')).toEqual([]);
    expect(catalog.patterns).toHaveLength(1);
  });

  it('rejects an unknown preset family and invalid envelope, range or polyphony', () => {
    expect(errors(sources({ presets: [preset({ family: 'theremin' })] }))).toMatch(/family/);
    expect(
      errors(
        sources({
          presets: [preset({ envelope: { attack: 5, decay: 0.1, sustain: 0.5, release: 0.1 } })],
        }),
      ),
    ).toMatch(/envelope/);
    expect(errors(sources({ presets: [preset({ range: { low: 'X4', high: 'C6' } })] }))).toMatch(
      /range/,
    );
    expect(errors(sources({ presets: [preset({ polyphony: 9 })] }))).toMatch(/polyphony/);
  });

  it('rejects an unknown role, era or motif reference', () => {
    expect(errors(sources({ patterns: [pattern({ tracks: { kazoo: [] } })] }))).toMatch(
      /role "kazoo"/,
    );
    expect(errors(sources({ patterns: [pattern({ eraId: 'medieval' })] }))).toMatch(
      /era "medieval"/,
    );
    expect(
      errors(sources({ patterns: [pattern({ motifRef: { id: 'ghost', revision: 1 } })] })),
    ).toMatch(/motif/);
    expect(
      errors(sources({ arrangements: [arrangement({ roles: { lead: { preset: 'missing' } } })] })),
    ).toMatch(/preset "missing"/);
    expect(errors(sources({ eras: [era({ defaultArrangement: 'nope' })] }))).toMatch(
      /arrangement "nope"/,
    );
  });

  it('requires attribution for CC BY material', () => {
    expect(errors(sources({ patterns: [pattern({ license: 'CC-BY-4.0' })] }))).toMatch(
      /attribution/,
    );
    expect(
      errors(
        sources({ patterns: [pattern({ license: 'CC-BY-4.0', attribution: 'A. Composer' })] }),
      ),
    ).toBe('');
  });

  it('keeps reviews out of patterns', () => {
    expect(errors(sources({ patterns: [pattern({ review: { status: 'approved' } })] }))).toMatch(
      /review/,
    );
  });

  it('checks size limits before expensive analysis', () => {
    const many = Array.from({ length: 1100 }, (_, i) => ({
      type: 'drum',
      step: i % 64,
      length: 1,
      sound: 'hat',
    }));
    expect(errors(sources({ patterns: [pattern({ tracks: { percussion: many } })] }))).toMatch(
      /1024|events|items/,
    );
  });
});

describe('review documents', () => {
  const valid = {
    schemaVersion: 1,
    patternId: 'fixture-a',
    revision: 1,
    contentHash: 'a'.repeat(64),
    status: 'approved',
    rating: 4,
  };

  it('accepts a valid review', () => {
    expect(validateReview(valid).errors).toEqual([]);
  });

  it.each([
    ['status', { ...valid, status: 'great' }],
    ['rating', { ...valid, rating: 6 }],
    ['hash', { ...valid, contentHash: 'xyz' }],
  ])('rejects an invalid %s', (_label, value) => {
    expect(validateReview(value).errors.length).toBeGreaterThan(0);
  });

  it('rejects an arrangement whose voices plus one care sound exceed the cap of 8', () => {
    const wide = (drums: number) =>
      sources({
        presets: [
          preset({ id: 'test-lead', polyphony: 4 }),
          JSON.parse(
            JSON.stringify(
              preset({ id: 'test-drums', family: 'noise', range: undefined, polyphony: drums }),
            ),
          ),
        ],
      });
    expect(errors(wide(3))).toBe(''); // 4 + 3 + 1 SFX = 8
    expect(errors(wide(4))).toMatch(/test-arrangement.*voice budget/);
  });
});
