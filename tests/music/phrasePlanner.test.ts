import { describe, expect, it } from 'vitest';
import { compilePhrase, createHorizon, GLOBAL_VOICE_CAP } from '../../src/music/core/phrasePlanner';
import type { NormalizedEvent, NormalizedPattern } from '../../src/music/core/validation';
import type { ArrangementDocument, PresetDocument } from '../../src/music/data/patterns.generated';

const note = (role: string, step: number, length: number, midi: number): NormalizedEvent => ({
  role,
  type: 'note',
  step,
  length,
  velocity: 0.8,
  midi,
  sound: null,
});

function pattern(events: NormalizedEvent[]): NormalizedPattern {
  return {
    id: 'p',
    revision: 1,
    eraId: 'discovery',
    bpm: 120,
    bars: 4,
    stepsPerBar: 16,
    timeSignature: { numerator: 4, denominator: 4 },
    totalSteps: 64,
    energy: 0.5,
    entryGroup: 'tonic',
    exitGroup: 'tonic',
    events,
  };
}

const presets = new Map<string, PresetDocument>(
  ['lead', 'bass', 'arp'].map((id) => [
    id,
    {
      schemaVersion: 1,
      id,
      revision: 1,
      family: id === 'bass' ? 'triangle' : id === 'arp' ? 'arp' : 'pulse',
      level: 0.5,
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1 },
      polyphony: id === 'arp' ? 4 : 1,
    } satisfies PresetDocument,
  ]),
);

const arrangement: ArrangementDocument = {
  schemaVersion: 1,
  id: 'arr',
  revision: 1,
  roles: {
    lead: { preset: 'lead' },
    bass: { preset: 'bass', enabled: false },
    arp: { preset: 'arp' },
  },
};

describe('phrase compiler', () => {
  it('turns steps into absolute ticks with a shared start for all tracks', () => {
    const plan = compilePhrase(
      pattern([note('lead', 0, 4, 76), note('arp', 0, 2, 72)]),
      arrangement,
      presets,
      3072,
      192,
    );
    expect(plan.startTick).toBe(3072);
    expect(plan.endTick).toBe(6144);
    expect(plan.events.map((e) => e.startTick)).toEqual([3072, 3072]);
    expect(plan.events.find((e) => e.role === 'lead')?.endTick).toBe(3072 + 4 * 48);
  });

  it('drops disabled roles and unassigned roles', () => {
    const plan = compilePhrase(
      pattern([note('bass', 0, 4, 40), note('kazoo', 0, 4, 60), note('lead', 0, 4, 76)]),
      arrangement,
      presets,
      0,
      192,
    );
    expect(plan.events.map((e) => e.role)).toEqual(['lead']);
    expect(plan.dropped).toBe(2);
  });

  it('keeps the global voice cap', () => {
    const chord = Array.from({ length: 12 }, (_, i) => note('arp', 0, 8, 60 + i));
    const crowded = { ...arrangement, roles: { ...arrangement.roles } };
    const many = new Map(presets);
    many.set('arp', { ...(presets.get('arp') as PresetDocument), polyphony: 4 });
    const plan = compilePhrase(pattern(chord), crowded, many, 0, 192);
    expect(plan.events.length).toBeLessThanOrEqual(GLOBAL_VOICE_CAP);
    expect(plan.dropped).toBeGreaterThan(0);
  });

  it('does not mutate the source pattern', () => {
    const source = pattern([note('lead', 0, 4, 76)]);
    const copy = JSON.stringify(source);
    compilePhrase(source, arrangement, presets, 0, 192);
    expect(JSON.stringify(source)).toBe(copy);
  });
});

describe('bounded horizon over 30 minutes', () => {
  it('keeps boundaries exact and at most current + next phrase scheduled', () => {
    const horizon = createHorizon();
    let start = 0;
    let maxLive = 0;
    const phrases = (30 * 60) / 8;
    for (let i = 0; i < phrases; i += 1) {
      const plan = compilePhrase(
        pattern([note('lead', 0, 4, 76)]),
        arrangement,
        presets,
        start,
        192,
      );
      horizon.add(plan);
      horizon.completeBefore(plan.startTick);
      maxLive = Math.max(maxLive, horizon.size());
      expect(plan.startTick).toBe(i * 3072);
      start = plan.endTick;
    }
    expect(maxLive).toBeLessThanOrEqual(2);
    expect(start).toBe(phrases * 3072);
  });
});
