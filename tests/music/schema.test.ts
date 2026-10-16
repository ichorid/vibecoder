import { describe, expect, it } from 'vitest';
import { validatePatternStructure } from '../../src/music/core/schema';

function pattern(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: 'fixture-note',
    revision: 1,
    eraId: 'discovery',
    bars: 4,
    key: { tonic: 'C', mode: 'major' },
    harmony: [{ step: 0, length: 64, chord: 'C' }],
    energy: 0.5,
    tracks: {
      lead: [{ type: 'note', step: 0, length: 4, pitch: 'E5', velocity: 0.8 }],
      percussion: [{ type: 'drum', step: 0, length: 1, sound: 'kick' }],
    },
    boundary: { entryGroup: 'tonic', exitGroup: 'tonic' },
    motifRef: { id: 'demo-main', revision: 1 },
    license: 'CC0-1.0',
    demo: false,
    ...overrides,
  };
}

const paths = (value: unknown) => validatePatternStructure(value).errors.map((e) => e.path);

describe('pattern schema', () => {
  it('accepts a minimal note and drum pattern', () => {
    expect(validatePatternStructure(pattern()).errors).toEqual([]);
  });

  it('rejects a wrong schema version', () => {
    expect(paths(pattern({ schemaVersion: 2 }))).toContain('/schemaVersion');
  });

  it('rejects an unknown field', () => {
    expect(validatePatternStructure(pattern({ tempoMagic: true })).errors[0]?.message).toMatch(
      /tempoMagic/,
    );
  });

  it('rejects a negative length and a fractional step with their paths', () => {
    const negative = pattern({
      tracks: { lead: [{ type: 'note', step: 0, length: -1, pitch: 'C5' }] },
    });
    expect(paths(negative).some((p) => p.startsWith('/tracks/lead/0'))).toBe(true);
    const fractional = pattern({
      tracks: { lead: [{ type: 'note', step: 1.5, length: 1, pitch: 'C5' }] },
    });
    expect(paths(fractional).some((p) => p.startsWith('/tracks/lead/0'))).toBe(true);
  });

  it('rejects a pitch on a drum event and an out-of-range velocity', () => {
    const drum = pattern({
      tracks: { percussion: [{ type: 'drum', step: 0, length: 1, sound: 'kick', pitch: 'C2' }] },
    });
    expect(paths(drum).some((p) => p.startsWith('/tracks/percussion/0'))).toBe(true);
    const loud = pattern({
      tracks: { lead: [{ type: 'note', step: 0, length: 1, pitch: 'C5', velocity: 2 }] },
    });
    expect(paths(loud).some((p) => p.startsWith('/tracks/lead/0'))).toBe(true);
  });
});
