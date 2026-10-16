import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../src/music/core/catalog';
import { checkBankCompatibility, DEFAULT_BOUNDARY_RULES } from '../../src/music/core/compatibility';
import { compilePhrase } from '../../src/music/core/phrasePlanner';
import { compareBank } from '../../src/music/core/similarity';
import { analyzePattern, type NormalizedPattern } from '../../src/music/core/validation';
import { parseMidi } from './midiFile';
import {
  chooseReading,
  chordName,
  estimateKey,
  importAll,
  mapPitchClass,
  patternFile,
  type ImportPlan,
} from './midiImportLib';
import { readRepository } from './sources';

const SOURCE = 'music/sources/rpgchip';
const plan = JSON.parse(readFileSync(path.join(SOURCE, 'plan.json'), 'utf8')) as ImportPlan;
const repository = readRepository('music');
const { catalog } = buildCatalog(repository);
const readMidi = (file: string) => parseMidi(readFileSync(path.join(SOURCE, file)));

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

describe('importing the CC0 RPG chiptunes', () => {
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
    const sources = repositoryFiles();
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
      expect(pattern.attribution).toContain('Aureolus_Omicron');
      expect(pattern.demo).toBe(false);
    }
  });

  it('gives every era at least two patterns, and each song a fair share', () => {
    for (const era of catalog.eras.keys()) {
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

function repositoryFiles(): string[] {
  return readdirSync(SOURCE)
    .filter((f) => f.endsWith('.mid'))
    .sort();
}
