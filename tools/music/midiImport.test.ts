import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Note } from 'tonal';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../src/music/core/catalog';
import { checkBankCompatibility, DEFAULT_BOUNDARY_RULES } from '../../src/music/core/compatibility';
import { compilePhrase } from '../../src/music/core/phrasePlanner';
import { compareBank } from '../../src/music/core/similarity';
import { analyzePattern, type NormalizedPattern } from '../../src/music/core/validation';
import { parseMidi, type MidiFile } from './midiFile';
import {
  chooseReading,
  chordName,
  estimateKey,
  importAll,
  mapPitchClass,
  patternFile,
  type ImportPlan,
} from './midiImportLib';
import { readSong, SONG_EXTENSIONS } from './songFile';
import { readRepository } from './sources';

const SOURCE = 'music/sources/rpgchip';
const planOf = (dir: string) =>
  JSON.parse(readFileSync(path.join(dir, 'plan.json'), 'utf8')) as ImportPlan;
const plan = planOf(SOURCE);
const repository = readRepository('music');
const { catalog } = buildCatalog(repository);
const readMidi = (file: string) => parseMidi(readFileSync(path.join(SOURCE, file)));
const reader =
  (dir: string) =>
  (file: string): MidiFile =>
    readSong(file, readFileSync(path.join(dir, file)));

/** Every source set: the RPG MIDI pack and the cyber/demoscene tracker modules. */
const SETS = [
  { dir: 'music/sources/rpgchip', keptLeadEras: ['recursion'] },
  { dir: 'music/sources/cyber', keptLeadEras: [] },
] as const;

describe('mode recolouring (scale degree to scale degree)', () => {
  it('keeps a major tune major, and moves minor ♭6 to the dorian 6', () => {
    for (let pc = 0; pc < 12; pc += 1) expect(mapPitchClass(pc, 'major', 'major')).toBe(pc);
    expect(mapPitchClass(8, 'minor', 'dorian')).toBe(9);
    expect(mapPitchClass(2, 'minor', 'phrygian')).toBe(1);
    expect(mapPitchClass(3, 'minor', 'minor')).toBe(3);
  });

  it('keeps a chromatic note at the same distance above its scale degree', () => {
    // F# in C major (#4) stays a semitone above the 4th in C mixolydian.
    expect(mapPitchClass(6, 'major', 'mixolydian')).toBe(6);
    // E (major 3rd over a minor tonic) sits a semitone above ♭3; in dorian too.
    expect(mapPitchClass(4, 'minor', 'dorian')).toBe(4);
  });
});

describe('key and chords', () => {
  it('finds the tonic of the requested family (relative major or minor)', () => {
    const town = readMidi('rpgchip03_town.mid');
    expect(estimateKey(town.notes, 'major').tonic).toBe(4); // E major
    const rainy = readMidi('rpgchip09_rainy_streets.mid');
    expect(estimateKey(rainy.notes, 'minor').tonic).toBe(11); // B minor
  });

  it('reads a song by the tonic its progression returns to when the profile is misleading', () => {
    // The Evil One profiles as G minor, but its chords circle E (E–C–D–C): no window starts on G.
    const evil = readMidi('rpgchip12_the_evil_one.mid');
    const song = plan.songs.find((s) => s.id === 'rpg-evil');
    if (!song) throw new Error('missing rpg-evil');
    expect(estimateKey(evil.notes, 'minor').tonic).toBe(7);
    expect(chooseReading(evil, song, catalog)).toEqual({ tonic: 4, stretch: 1 });
  });

  it('names chords in the spelling of the key', () => {
    expect(chordName(2, 'minor', 'D dorian')).toBe('Dm');
    expect(chordName(10, 'major', 'D dorian')).toBe('Bb');
    expect(chordName(11, 'dim', 'C major')).toBe('Bdim');
    expect(chordName(10, 'major', 'A minor')).toBe('Bb'); // ♭II as B♭, not A♯
    expect(chordName(4, 'major', 'A minor')).toBe('E');
  });
});

for (const set of SETS) {
  const plan = planOf(set.dir);
  const readMidi = reader(set.dir);
  const creditOf = (id: string) =>
    (plan.songs.find((song) => id.startsWith(`${song.id}-`))?.source ?? plan.source).author;

  describe(`importing ${set.dir}`, () => {
    const result = importAll(plan, readMidi, catalog);
    const byEra = new Map<string, NormalizedPattern[]>();
    for (const pattern of result.patterns) {
      const analysis = analyzePattern(pattern, catalog);
      if (analysis.normalized) {
        byEra.set(pattern.eraId, [...(byEra.get(pattern.eraId) ?? []), analysis.normalized]);
      }
    }

    it('accounts for every source file: imported or skipped with a reason', () => {
      const files = new Set([...plan.songs.map((s) => s.file), ...plan.skipped.map((s) => s.file)]);
      const sources = repositoryFiles(set.dir);
      expect([...files].sort()).toEqual(sources);
      for (const skipped of plan.skipped) expect(skipped.reason.length).toBeGreaterThan(10);
    });

    it('every pattern is playable: no validation errors, the era clock, CC0 with credit', () => {
      expect(result.patterns.length).toBeGreaterThan(0);
      for (const pattern of result.patterns) {
        const errors = analyzePattern(pattern, catalog).diagnostics.filter(
          (d) => d.level === 'error',
        );
        expect(errors, pattern.id).toEqual([]);
        expect(pattern.bpm, pattern.id).toBeUndefined();
        expect(pattern.license).toBe('CC0-1.0');
        expect(pattern.attribution).toContain(creditOf(pattern.id));
        expect(pattern.demo).toBe(false);
      }
    });

    it('gives every era it feeds at least two patterns, and each song a fair share', () => {
      for (const era of new Set(plan.songs.map((s) => s.era))) {
        expect(byEra.get(era)?.length ?? 0, era).toBeGreaterThanOrEqual(2);
      }
      for (const song of plan.songs) {
        const count = result.patterns.filter((p) => p.id.startsWith(`${song.id}-`)).length;
        expect(count, song.file).toBeGreaterThanOrEqual(1);
        expect(count, song.file).toBeLessThanOrEqual(plan.maxPerSong);
      }
    });

    it('the phrase planner plays every event: no role exceeds its preset polyphony', () => {
      for (const pattern of result.patterns) {
        const normalizedPattern = analyzePattern(pattern, catalog).normalized;
        const base = catalog.arrangements.get(
          catalog.eras.get(pattern.eraId)?.defaultArrangement ?? '',
        );
        if (!normalizedPattern || !base) throw new Error(pattern.id);
        const everyRole = {
          ...base,
          roles: Object.fromEntries(
            Object.entries(base.roles).flatMap(([role, a]) =>
              a ? [[role, { ...a, enabled: true }] as const] : [],
            ),
          ),
        };
        expect(
          compilePhrase(normalizedPattern, everyRole, catalog.presets, 0, 192).dropped,
          pattern.id,
        ).toBe(0);
      }
    });

    it('any two patterns of an era can follow each other (tonic entry, tonic/dominant exit)', () => {
      for (const [era, bank] of byEra) {
        expect(checkBankCompatibility(bank, DEFAULT_BOUNDARY_RULES), era).toEqual([]);
      }
    });

    it('no two patterns of an era are the same music or near variants', () => {
      for (const [era, bank] of byEra) expect(compareBank(bank), era).toEqual([]);
    });

    it('is deterministic, and the committed pattern files are exactly its output', () => {
      expect(importAll(plan, readMidi, catalog).patterns).toEqual(result.patterns);
      for (const pattern of result.patterns) {
        const file = path.join('music', patternFile(pattern));
        expect(JSON.parse(readFileSync(file, 'utf8')), file).toEqual(pattern);
      }
    });
  });
}

function repositoryFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => SONG_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext)))
    .sort();
}

for (const set of SETS) {
  const plan = planOf(set.dir);
  const result = importAll(plan, reader(set.dir), catalog);
  const songOf = (id: string) => plan.songs.find((s) => id.startsWith(`${s.id}-`));

  describe(`lead style in ${set.dir} (listening: Recursion good; elsewhere whiny, long, high main tones)`, () => {
    it('the plan caps held lead notes and centres leads near C5, unless a song keeps its lead', () => {
      expect(plan.lead).toEqual({ maxSteps: 6, centre: 'C5' });
      const kept = plan.songs.filter((s) => s.lead).map((s) => s.era);
      expect(new Set(kept)).toEqual(new Set(set.keptLeadEras));
    });

    it('styled leads: no note longer than the cap or over an octave from C5, averaging within a fifth', () => {
      const centre = Note.midi(plan.lead?.centre ?? 'C5') ?? 72;
      for (const pattern of result.patterns) {
        if (songOf(pattern.id)?.lead) continue;
        const lead = (pattern.tracks.lead ?? []).flatMap((e) => (e.type === 'note' ? [e] : []));
        if (lead.length === 0) continue;
        for (const n of lead)
          expect(n.length, pattern.id).toBeLessThanOrEqual(plan.lead?.maxSteps ?? 6);
        for (const n of lead) {
          expect(Math.abs((Note.midi(n.pitch) ?? 0) - centre), pattern.id).toBeLessThanOrEqual(12);
        }
        const mean = lead.reduce((sum, n) => sum + (Note.midi(n.pitch) ?? 0), 0) / lead.length;
        expect(Math.abs(mean - centre), pattern.id).toBeLessThanOrEqual(7);
      }
    });
  });
}
