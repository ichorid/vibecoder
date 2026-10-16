/** Technical fixtures for music tests (not demo compositions). */
export function era(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: 'discovery',
    revision: 1,
    title: 'Discovery',
    mood: 'test',
    clockGroup: 'standard',
    defaults: {
      bpm: 120,
      bars: 4,
      stepsPerBar: 16,
      timeSignature: { numerator: 4, denominator: 4 },
    },
    key: { tonic: 'C', modes: ['major'] },
    defaultArrangement: 'test-arrangement',
    emptyBankPolicy: 'keep-current',
    ...overrides,
  };
}

export function preset(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: 'test-lead',
    revision: 1,
    family: 'pulse',
    level: 0.5,
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.5, release: 0.1 },
    range: { low: 'C4', high: 'C6' },
    polyphony: 1,
    ...overrides,
  };
}

export function arrangement(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: 'test-arrangement',
    revision: 1,
    roles: { lead: { preset: 'test-lead' }, percussion: { preset: 'test-drums' } },
    ...overrides,
  };
}

export function drums() {
  return preset({ id: 'test-drums', family: 'noise', range: undefined, polyphony: 2 });
}

export function motif(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: 'demo-main',
    revision: 1,
    status: 'demo',
    degrees: [3, 5, 6, 5],
    license: 'CC0-1.0',
    ...overrides,
  };
}

export function pattern(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: 'fixture-a',
    revision: 1,
    eraId: 'discovery',
    bars: 4,
    key: { tonic: 'C', mode: 'major' },
    harmony: [{ step: 0, length: 64, chord: 'C' }],
    energy: 0.5,
    tracks: {
      lead: [
        { type: 'note', step: 0, length: 4, pitch: 'E5' },
        { type: 'note', step: 4, length: 4, pitch: 'G5' },
      ],
      percussion: [{ type: 'drum', step: 0, length: 1, sound: 'kick' }],
    },
    boundary: { entryGroup: 'tonic', exitGroup: 'tonic' },
    motifRef: { id: 'demo-main', revision: 1 },
    license: 'CC0-1.0',
    demo: true,
    ...overrides,
  };
}

export function sources(
  overrides: Partial<
    Record<'eras' | 'presets' | 'arrangements' | 'motifs' | 'patterns', unknown[]>
  > = {},
) {
  return {
    eras: [era()],
    presets: [JSON.parse(JSON.stringify(preset())), JSON.parse(JSON.stringify(drums()))],
    arrangements: [arrangement()],
    motifs: [motif()],
    patterns: [pattern()],
    ...overrides,
  };
}
