/**
 * Turn third-party CC0 MIDI songs into candidate patterns for the era banks (`music:import-midi`).
 *
 * Per song (an entry of `music/sources/<set>/plan.json`): estimate the source key in the family
 * of the target mode, map channels to roles (bass = lowest; lead = highest independent melody;
 * arp = the busiest other independent line, else the pads arpeggiated), transpose to the era
 * tonic and recolour scale degree by degree into the era mode, quantize onto the era grid
 * (one source sixteenth = one step, or two for slow songs: half-time), label one chord per bar,
 * then cut four-bar windows that start on the tonic chord and end on the tonic or dominant (so
 * any two patterns of a bank can follow each other). Near-duplicate windows are skipped with the
 * same similarity rule as `music:validate`. The output is unreviewed: a human approves in the Lab.
 */
import { Note, Scale } from 'tonal';
import type { MusicCatalog } from '../../src/music/core/catalog';
import { comparePatterns } from '../../src/music/core/similarity';
import { analyzePattern, type NormalizedPattern } from '../../src/music/core/validation';
import type { PatternDocument } from '../../src/music/data/patterns.generated';
import type { MidiFile, MidiNote } from './midiFile';

export interface SongPlan {
  readonly file: string;
  /** Pattern ids are `<id>-a`, `<id>-b`, … */
  readonly id: string;
  readonly era: string;
  readonly mood: string;
  /** One of the era's modes (default: its first). */
  readonly mode?: string;
  /** Steps per source sixteenth: 1, or 2 for half-time (default: searched, tempo-closest first). */
  readonly stretch?: 1 | 2;
  /** The source tonic, e.g. "E" (default: searched among the best-fitting keys). */
  readonly sourceTonic?: string;
  /** Channel overrides when the role heuristic is wrong. */
  readonly roles?: Partial<Record<'lead' | 'bass' | 'arp', number>>;
}

export interface ImportPlan {
  readonly source: {
    readonly title: string;
    readonly author: string;
    readonly url: string;
    readonly license: 'CC0-1.0';
  };
  readonly maxPerSong: number;
  readonly songs: readonly SongPlan[];
  readonly skipped: readonly { readonly file: string; readonly reason: string }[];
}

export interface ImportResult {
  readonly patterns: PatternDocument[];
  /** One line per song: what was taken and why some windows were not. */
  readonly report: string[];
}

type Event = PatternDocument['tracks'][string] extends (infer E)[] | undefined ? E : never;

const MODES: Readonly<Record<string, readonly number[]>> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};
const DRUM_CHANNEL = 9;
const STEPS_PER_BAR = 16;
const PHRASE_BARS = 4;
const PHRASE_STEPS = STEPS_PER_BAR * PHRASE_BARS;
/** General MIDI percussion → the three noise sounds. */
const KICKS = new Set([35, 36, 41, 43]);
const SNARES = new Set([37, 38, 39, 40, 45, 47, 48, 50]);
const HATS = new Set([42, 44, 46, 49, 51, 52, 53, 55, 57, 59]);

const scaleOf = (mode: string): readonly number[] => {
  const scale = MODES[mode];
  if (!scale) throw new Error(`unsupported mode "${mode}"`);
  return scale;
};
export const familyOf = (mode: string): 'major' | 'minor' =>
  scaleOf(mode)[2] === 4 ? 'major' : 'minor';
const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** A pitch class relative to the tonic, moved from one mode's degree to the same degree of another. */
export function mapPitchClass(pc: number, from: string, to: string): number {
  const a = scaleOf(from);
  const b = scaleOf(to);
  let degree = 6;
  while ((a[degree] ?? 0) > pc) degree -= 1;
  return mod12((b[degree] ?? 0) + pc - (a[degree] ?? 0));
}

// Krumhansl–Kessler key profiles.
const PROFILE = {
  major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
};

function correlation(x: readonly number[], y: readonly number[]): number {
  const mx = x.reduce((s, v) => s + v, 0) / 12;
  const my = y.reduce((s, v) => s + v, 0) / 12;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < 12; i += 1) {
    const a = (x[i] ?? 0) - mx;
    const b = (y[i] ?? 0) - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

/** The best tonic (pitch class) for a major- or minor-family reading of the song. */
export function estimateKey(
  notes: readonly MidiNote[],
  family: 'major' | 'minor',
): { tonic: number; fit: number } {
  return rankKeys(notes, family)[0] ?? { tonic: 0, fit: 0 };
}

/** Every tonic of the family, best profile fit first. */
export function rankKeys(
  notes: readonly MidiNote[],
  family: 'major' | 'minor',
): { tonic: number; fit: number }[] {
  const histogram = Array.from({ length: 12 }, () => 0);
  for (const n of notes) {
    const pc = n.pitch % 12;
    if (n.channel !== DRUM_CHANNEL) histogram[pc] = (histogram[pc] ?? 0) + n.end - n.start;
  }
  return Array.from({ length: 12 }, (_, tonic) => {
    const rotated = [...histogram.slice(tonic), ...histogram.slice(0, tonic)];
    return { tonic, fit: correlation(rotated, PROFILE[family]) };
  }).sort((a, b) => b.fit - a.fit || a.tonic - b.tonic);
}

/** Chromatic notes by their distance from the tonic: ♭2 ♭3 ♭6 ♭7 as flats, the rest as sharps. */
const CHROMATIC_INTERVALS = [
  '1P',
  '2m',
  '2M',
  '3m',
  '3M',
  '4P',
  '4A',
  '5P',
  '6m',
  '6M',
  '7m',
  '7M',
];

/** A pitch-class name spelled as the key spells it (scale notes, else by interval from the tonic). */
function pitchClassName(chroma: number, keyName: string): string {
  const scale = Scale.get(keyName);
  const inScale = scale.notes.find((n) => Note.chroma(n) === chroma);
  const tonic = scale.tonic ?? 'C';
  const name =
    inScale ??
    Note.transpose(tonic, CHROMATIC_INTERVALS[mod12(chroma - (Note.chroma(tonic) ?? 0))] ?? '1P');
  // Keep octave numbers honest: no Cb, Fb, E#, B# or double accidentals.
  return /^(Cb|Fb|E#|B#)$|##|bb/.test(name) ? Note.simplify(name) : name;
}

const pitchName = (midi: number, keyName: string) =>
  `${pitchClassName(mod12(midi), keyName)}${Math.floor(midi / 12) - 1}`;

export function chordName(root: number, quality: 'major' | 'minor' | 'dim', keyName: string) {
  const suffix = quality === 'major' ? '' : quality === 'minor' ? 'm' : 'dim';
  return `${pitchClassName(root, keyName)}${suffix}`;
}

interface Channel {
  readonly channel: number;
  readonly notes: readonly MidiNote[];
  readonly meanPitch: number;
  readonly perBeat: number;
  readonly distinct: number;
  /** Onsets mostly shared with another channel, and slow or few pitches: a chord voice (pad). */
  readonly chordal: boolean;
}

export function channels(midi: MidiFile): Channel[] {
  const beats = Math.max(1, Math.max(...midi.notes.map((n) => n.end)) / midi.ppq);
  const byChannel = new Map<number, MidiNote[]>();
  for (const n of midi.notes) {
    if (n.channel === DRUM_CHANNEL) continue;
    byChannel.set(n.channel, [...(byChannel.get(n.channel) ?? []), n]);
  }
  const onsets = new Map<number, Set<number>>();
  for (const [ch, list] of byChannel) onsets.set(ch, new Set(list.map((n) => n.start)));
  return [...byChannel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([channel, list]) => {
      const shared = list.filter((n) =>
        [...onsets.entries()].some(([other, set]) => other !== channel && set.has(n.start)),
      ).length;
      return {
        channel,
        notes: list,
        meanPitch: list.reduce((s, n) => s + n.pitch, 0) / list.length,
        perBeat: list.length / beats,
        distinct: new Set(list.map((n) => n.pitch)).size,
        chordal:
          shared / list.length >= 0.8 &&
          (list.length / beats <= 0.3 || new Set(list.map((n) => n.pitch)).size <= 6),
      };
    });
}

interface Roles {
  readonly lead: Channel | null;
  readonly bass: Channel | null;
  readonly arp: Channel | null;
  /** Chord voices left over (arpeggiated when there is no arp line). */
  readonly pads: readonly Channel[];
}

export function assignRoles(list: readonly Channel[], overrides: SongPlan['roles']): Roles {
  const pick = (ch: number | undefined) => list.find((c) => c.channel === ch) ?? null;
  const melodic = list.filter((c) => !c.chordal && c.distinct >= 4);
  const byPitch = (cs: readonly Channel[]) =>
    [...cs].sort((a, b) => a.meanPitch - b.meanPitch || a.channel - b.channel);
  // An active low line is the bass; otherwise the lowest voice (often the pads' root).
  const lowLine = byPitch(melodic).find((c) => c.meanPitch < 50);
  const bass = pick(overrides?.bass) ?? lowLine ?? byPitch(list)[0] ?? null;
  const free = list.filter((c) => c !== bass);
  const tunes = melodic.filter((c) => c !== bass);
  // The highest independent melody; a song without one keeps its top chord voice as the lead.
  const lead =
    pick(overrides?.lead) ??
    byPitch(tunes).at(-1) ??
    byPitch(free.filter((c) => c.chordal)).at(-1) ??
    null;
  const arp =
    pick(overrides?.arp) ??
    [...tunes]
      .filter((c) => c !== lead && c.perBeat >= 0.5)
      .sort((a, b) => b.perBeat - a.perBeat || a.channel - b.channel)[0] ??
    null;
  const pads = free.filter((c) => c !== lead && c !== arp && c.chordal);
  return { lead, bass, arp, pads };
}

interface Placed {
  readonly step: number;
  readonly length: number;
  readonly midi: number;
  readonly velocity: number;
}

export interface Song {
  readonly plan: SongPlan;
  readonly mode: string;
  readonly keyName: string;
  readonly sourceKey: string;
  readonly stretch: 1 | 2;
  readonly roles: Roles;
  readonly totalSteps: number;
  /** Role → notes on the whole-song step grid, already in the target key and mode. */
  readonly lines: Readonly<Record<'lead' | 'bass' | 'arp', readonly Placed[]>>;
  readonly arpFromPads: boolean;
  readonly drums: readonly { step: number; sound: 'kick' | 'snare' | 'hat'; velocity: number }[];
  /** One chord per bar of the song grid: [root relative to the tonic, quality]. */
  readonly chords: readonly (readonly [number, 'major' | 'minor' | 'dim'])[];
  readonly bpm: number;
}

export interface Reading {
  readonly tonic: number;
  readonly stretch: 1 | 2;
}

export function prepare(
  midi: MidiFile,
  plan: SongPlan,
  catalog: MusicCatalog,
  reading?: Reading,
): Song {
  const era = catalog.eras.get(plan.era);
  if (!era) throw new Error(`${plan.file}: unknown era "${plan.era}"`);
  const mode = plan.mode ?? era.key.modes[0] ?? 'major';
  if (!era.key.modes.includes(mode)) {
    throw new Error(`${plan.file}: mode "${mode}" is not one of ${plan.era}'s modes`);
  }
  const keyName = `${era.key.tonic} ${mode}`;
  const tonic = Note.chroma(era.key.tonic) ?? 0;
  const family = familyOf(mode);
  const source = { tonic: reading?.tonic ?? estimateKey(midi.notes, family).tonic };
  const sourceMode = family === 'major' ? 'major' : 'minor';
  const bpm = midi.tempos[0]?.bpm ?? 120;
  const eraBpm = era.defaults.bpm;
  const stretch = reading?.stretch ?? plan.stretch ?? preferredStretch(bpm, eraBpm);
  const sixteenth = midi.ppq / 4;
  const toStep = (tick: number) => Math.round((tick / sixteenth) * stretch);
  const shift = mod12(tonic - source.tonic);
  const transpose = (pitch: number) => {
    const relative = mod12(pitch - source.tonic);
    const mapped = mapPitchClass(relative, sourceMode, mode);
    // Same octave neighbourhood: source pitch + key shift, then the recoloured degree.
    const base = pitch + (shift > 6 ? shift - 12 : shift);
    return (
      base +
      (mapped - relative > 6
        ? mapped - relative - 12
        : mapped - relative < -6
          ? mapped - relative + 12
          : mapped - relative)
    );
  };
  const place = (n: MidiNote): Placed => {
    const step = toStep(n.start);
    return {
      step,
      length: Math.max(1, toStep(n.end) - step),
      midi: transpose(n.pitch),
      velocity: Math.round((n.velocity / 127) * 100) / 100,
    };
  };
  const roles = assignRoles(channels(midi), plan.roles);
  const line = (c: Channel | null) => (c ? c.notes.map(place) : []);
  const pads = roles.pads.flatMap((c) => c.notes.map(place));
  const arpFromPads = !roles.arp && pads.length > 0;
  const lines = {
    lead: line(roles.lead),
    bass: line(roles.bass),
    arp: arpFromPads ? arpeggiate(pads) : line(roles.arp),
  };
  const totalSteps = Math.max(...midi.notes.map((n) => toStep(n.end)));
  const drums = midi.notes
    .filter((n) => n.channel === DRUM_CHANNEL)
    .flatMap((n) => {
      const sound = KICKS.has(n.pitch)
        ? 'kick'
        : SNARES.has(n.pitch)
          ? 'snare'
          : HATS.has(n.pitch)
            ? 'hat'
            : null;
      return sound
        ? [
            {
              step: toStep(n.start),
              sound,
              velocity: Math.round((n.velocity / 127) * 90) / 100,
            } as const,
          ]
        : [];
    });
  const everything = [...lines.lead, ...lines.bass, ...lines.arp, ...pads];
  const bars = Math.ceil(totalSteps / STEPS_PER_BAR);
  const chords = Array.from({ length: bars }, (_, bar) =>
    chordOfBar(everything, lines.bass, bar * STEPS_PER_BAR, tonic, mode),
  );
  const sourceName = `${pitchClassName(source.tonic, 'C major')} ${sourceMode}`;
  return {
    plan,
    mode,
    keyName,
    sourceKey: sourceName,
    stretch,
    roles,
    totalSteps,
    lines,
    arpFromPads,
    drums,
    chords,
    bpm,
  };
}

const preferredStretch = (bpm: number, eraBpm: number): 1 | 2 =>
  Math.abs(Math.log(eraBpm / 2 / bpm)) < Math.abs(Math.log(eraBpm / bpm)) ? 2 : 1;

/** Window starts (in steps) whose first bar is the tonic chord of the mode's quality and whose
 * last bar is the tonic, the dominant, or a chord the source resolves to the tonic. */
function boundaryStarts(song: Song): number[] {
  const tonicQuality = familyOf(song.mode) === 'major' ? 'major' : 'minor';
  const sourceBar = STEPS_PER_BAR * song.stretch;
  const starts: number[] = [];
  for (let s = 0; s + PHRASE_STEPS <= song.totalSteps; s += sourceBar) {
    const bar = s / STEPS_PER_BAR;
    const [first, quality] = song.chords[bar] ?? [-1, 'major'];
    const last = song.chords[bar + PHRASE_BARS - 1]?.[0];
    const after = song.chords[bar + PHRASE_BARS]?.[0];
    if (first === 0 && quality === tonicQuality && (last === 0 || last === 7 || after === 0)) {
      starts.push(s);
    }
  }
  return starts;
}

/**
 * How to read the song: the plan's tonic/stretch, else the first of the four best-fitting
 * tonics × (tempo-closest stretch, then the other) that yields at least two usable windows
 * (or the one with the most).
 */
export function chooseReading(midi: MidiFile, plan: SongPlan, catalog: MusicCatalog): Reading {
  const era = catalog.eras.get(plan.era);
  const mode = plan.mode ?? era?.key.modes[0] ?? 'major';
  const bpm = midi.tempos[0]?.bpm ?? 120;
  const preferred = preferredStretch(bpm, era?.defaults.bpm ?? 120);
  const stretches: (1 | 2)[] = plan.stretch ? [plan.stretch] : [preferred, preferred === 1 ? 2 : 1];
  const tonics =
    plan.sourceTonic !== undefined
      ? [Note.chroma(plan.sourceTonic) ?? 0]
      : rankKeys(midi.notes, familyOf(mode))
          .slice(0, 4)
          .map((k) => k.tonic);
  let best: { reading: Reading; count: number } | null = null;
  for (const stretch of stretches) {
    for (const tonic of tonics) {
      const reading = { tonic, stretch };
      const count = boundaryStarts(prepare(midi, plan, catalog, reading)).length;
      if (count >= 2) return reading;
      if (!best || count > best.count) best = { reading, count };
    }
  }
  return best?.reading ?? { tonic: tonics[0] ?? 0, stretch: preferred };
}

/** Pads → an eighth-note arpeggio over whatever chord tones sound, rising then wrapping. */
function arpeggiate(pads: readonly Placed[]): Placed[] {
  const end = Math.max(0, ...pads.map((p) => p.step + p.length));
  const out: Placed[] = [];
  for (let step = 0, i = 0; step < end; step += 2) {
    const sounding = pads
      .filter((p) => p.step <= step && step < p.step + p.length)
      .map((p) => p.midi)
      .sort((a, b) => a - b);
    const tones = [...new Set(sounding)];
    if (tones.length === 0) {
      i = 0;
      continue;
    }
    const octave = Math.floor(i / tones.length) % 2;
    const midi = (tones[i % tones.length] ?? 60) + 12 * octave;
    out.push({ step, length: 2, midi, velocity: 0.55 });
    i += 1;
  }
  return out;
}

const QUALITIES = [
  ['major', [0, 4, 7]],
  ['minor', [0, 3, 7]],
  ['dim', [0, 3, 6]],
] as const;

/** One chord for the bar: chord tones weighted by sounding time, the bass note's root favoured. */
function chordOfBar(
  notes: readonly Placed[],
  bass: readonly Placed[],
  from: number,
  tonic: number,
  mode: string,
): readonly [number, 'major' | 'minor' | 'dim'] {
  const to = from + STEPS_PER_BAR;
  const weight = Array.from({ length: 12 }, () => 0);
  for (const n of notes) {
    const overlap = Math.min(to, n.step + n.length) - Math.max(from, n.step);
    const pc = mod12(n.midi - tonic);
    if (overlap > 0) weight[pc] = (weight[pc] ?? 0) + overlap;
  }
  const bassNote = bass
    .filter((n) => n.step < to && n.step + n.length > from)
    .sort((a, b) => a.step - b.step)[0];
  const bassPc = bassNote ? mod12(bassNote.midi - tonic) : null;
  const total = weight.reduce((s, w) => s + w, 0) || 1;
  const scale = new Set(scaleOf(mode));
  let best: { score: number; root: number; quality: 'major' | 'minor' | 'dim' } = {
    score: -Infinity,
    root: 0,
    quality: 'major',
  };
  for (let root = 0; root < 12; root += 1) {
    for (const [quality, intervals] of QUALITIES) {
      const tones = intervals.map((i) => mod12(root + i));
      const inside = tones.reduce((s, t) => s + (weight[t] ?? 0), 0);
      let score = inside - 0.5 * (total - inside);
      if (bassPc === root) score += 0.3 * total;
      else if (bassPc !== null && tones.includes(bassPc)) score += 0.1 * total;
      if (tones.every((t) => scale.has(t))) score += 0.05 * total;
      if (quality === 'dim') score -= 0.05 * total;
      if (score > best.score) best = { score, root, quality };
    }
  }
  return [best.root, best.quality];
}

/** Octave-shift a role so its notes fit the preset range (fold the stragglers). */
function fitRange(notes: readonly Placed[], low: number, high: number): Placed[] {
  if (notes.length === 0) return [];
  let bestShift = 0;
  let bestFit = -1;
  for (const shift of [0, 12, -12, 24, -24, 36, -36]) {
    const fit = notes.filter((n) => n.midi + shift >= low && n.midi + shift <= high).length;
    if (fit > bestFit) {
      bestFit = fit;
      bestShift = shift;
    }
  }
  return notes.map((n) => {
    let midi = n.midi + bestShift;
    while (midi < low) midi += 12;
    while (midi > high) midi -= 12;
    return { ...n, midi };
  });
}

/** One voice: on a shared step keep the highest (lowest for bass); cut overlaps. */
function monophonic(notes: readonly Placed[], lowest: boolean): Placed[] {
  const sorted = [...notes].sort(
    (a, b) => a.step - b.step || (lowest ? a.midi - b.midi : b.midi - a.midi),
  );
  const out: Placed[] = [];
  for (const n of sorted) {
    const previous = out.at(-1);
    if (previous && previous.step === n.step) continue;
    if (previous && previous.step + previous.length > n.step) {
      out[out.length - 1] = { ...previous, length: n.step - previous.step };
    }
    out.push(n);
  }
  return out;
}

function windowNotes(notes: readonly Placed[], start: number): Placed[] {
  return notes
    .filter((n) => n.step >= start && n.step < start + PHRASE_STEPS)
    .map((n) => ({
      ...n,
      step: n.step - start,
      length: Math.min(n.length, start + PHRASE_STEPS - n.step),
    }));
}

const DRUM_ORDER = { kick: 0, snare: 1, hat: 2 } as const;

function presetFor(catalog: MusicCatalog, era: string, role: string) {
  const arrangement = catalog.arrangements.get(catalog.eras.get(era)?.defaultArrangement ?? '');
  return catalog.presets.get(arrangement?.roles[role]?.preset ?? '');
}

function rangeOf(catalog: MusicCatalog, era: string, role: string): [number, number] {
  const preset = presetFor(catalog, era, role);
  return [
    Note.midi(preset?.range?.low ?? 'C1') ?? 24,
    Note.midi(preset?.range?.high ?? 'C7') ?? 96,
  ];
}

const letter = (i: number) => String.fromCharCode(97 + i);
export const patternFile = (p: PatternDocument) =>
  `patterns/${p.eraId}/${p.id}.v${p.revision}.json`;

function buildPattern(
  song: Song,
  start: number,
  index: number,
  plan: ImportPlan,
  catalog: MusicCatalog,
): PatternDocument | null {
  const era = song.plan.era;
  const tracks: Record<string, Event[]> = {};
  for (const role of ['lead', 'bass', 'arp'] as const) {
    const [low, high] = rangeOf(catalog, era, role);
    const notes = monophonic(
      fitRange(windowNotes(song.lines[role], start), low, high),
      role === 'bass',
    );
    if (notes.length === 0) continue;
    tracks[role] = notes.map((n) => ({
      type: 'note' as const,
      step: n.step,
      length: n.length,
      pitch: pitchName(n.midi, song.keyName),
      velocity: n.velocity,
    }));
  }
  // One hit per sound and step; at most the kit's polyphony per step (kick, snare, then hat).
  const kit = presetFor(catalog, era, 'percussion')?.polyphony ?? 1;
  const seen = new Set<string>();
  const perStep = new Map<number, number>();
  const percussion = [...song.drums]
    .filter((d) => d.step >= start && d.step < start + PHRASE_STEPS)
    .sort((a, b) => a.step - b.step || DRUM_ORDER[a.sound] - DRUM_ORDER[b.sound])
    .flatMap((d) => {
      const key = `${d.step}|${d.sound}`;
      if (seen.has(key) || (perStep.get(d.step) ?? 0) >= kit) return [];
      seen.add(key);
      perStep.set(d.step, (perStep.get(d.step) ?? 0) + 1);
      return [
        {
          type: 'drum' as const,
          step: d.step - start,
          length: 1,
          sound: d.sound,
          velocity: d.velocity,
        },
      ];
    })
    .sort((a, b) => a.step - b.step || a.sound.localeCompare(b.sound));
  if (percussion.length > 0) tracks.percussion = percussion;
  const melodic = (tracks.lead?.length ?? 0) + (tracks.arp?.length ?? 0);
  if (melodic < 8) return null;

  const firstBar = start / STEPS_PER_BAR;
  const harmony = Array.from({ length: PHRASE_BARS }, (_, i) => {
    const [root, quality] = song.chords[firstBar + i] ?? [0, 'major'];
    const tonic = Note.chroma(song.keyName.split(' ')[0] ?? 'C') ?? 0;
    return {
      step: i * STEPS_PER_BAR,
      length: STEPS_PER_BAR,
      chord: chordName(mod12(tonic + root), quality, song.keyName),
    };
  }) as PatternDocument['harmony'];
  const lastRoot = song.chords[firstBar + PHRASE_BARS - 1]?.[0];
  const events = Object.values(tracks).reduce((s, t) => s + t.length, 0);
  const sourceBars = [
    start / (STEPS_PER_BAR * song.stretch) + 1,
    (start + PHRASE_STEPS) / (STEPS_PER_BAR * song.stretch),
  ];
  const roles = (['lead', 'bass', 'arp'] as const)
    .map((r) =>
      r === 'arp' && song.arpFromPads
        ? 'arp = pads arpeggiated'
        : `${r} = ch${(song.roles[r]?.channel ?? -1) + 1}`,
    )
    .join(', ');
  return {
    schemaVersion: 1,
    id: `${song.plan.id}-${letter(index)}`,
    revision: 1,
    eraId: era,
    bars: PHRASE_BARS,
    key: { tonic: song.keyName.split(' ')[0] ?? 'C', mode: song.mode },
    harmony,
    energy: Math.round(Math.min(1, 0.1 + events / PHRASE_STEPS / 2) * 100) / 100,
    tracks,
    // Out on the tonic; on V, or on a chord the source itself resolves to the tonic, "dominant".
    boundary: { entryGroup: 'tonic', exitGroup: lastRoot === 0 ? 'tonic' : 'dominant' },
    motifRef: { id: 'demo-main', revision: 1 },
    license: plan.source.license,
    attribution: `${plan.source.author} — "${plan.source.title}" (${plan.source.url})`,
    demo: false,
    metadata: {
      description: [
        `From ${song.plan.file}, source bars ${sourceBars[0]}–${sourceBars[1]}.`,
        `${song.sourceKey} → ${song.keyName}; ${song.stretch === 2 ? 'half-time (one source bar = two bars)' : 'one source bar = one bar'} at the era tempo (source ${Math.round(song.bpm)} bpm).`,
        `Roles: ${roles}.`,
        `Mood: ${song.plan.mood}`,
        'Does not quote the motif (imported material).',
      ].join(' '),
      composer: `${plan.source.author} (OpenGameArt, CC0); adapted by tools/music/importMidi.ts`,
    },
  };
}

function normalized(pattern: PatternDocument, catalog: MusicCatalog): NormalizedPattern | null {
  const analysis = analyzePattern(pattern, catalog);
  return analysis.diagnostics.some((d) => d.level === 'error') ? null : analysis.normalized;
}

/** Windows of one song: aligned four-bar phrases first, then any bar; tonic in, tonic/V out. */
function importSong(
  song: Song,
  plan: ImportPlan,
  catalog: MusicCatalog,
  bank: NormalizedPattern[],
): { patterns: PatternDocument[]; line: string } {
  const starts = boundaryStarts(song);
  const ordered = [
    ...starts.filter((s) => s % PHRASE_STEPS === 0),
    ...starts.filter((s) => s % PHRASE_STEPS !== 0),
  ];
  const taken: { start: number; pattern: PatternDocument }[] = [];
  const skipped = { empty: 0, invalid: 0, similar: 0 };
  for (const start of ordered) {
    if (taken.length >= plan.maxPerSong) break;
    if (taken.some((t) => Math.abs(t.start - start) < PHRASE_STEPS)) continue;
    const pattern = buildPattern(song, start, taken.length, plan, catalog);
    if (!pattern) {
      skipped.empty += 1;
      continue;
    }
    const norm = normalized(pattern, catalog);
    if (!norm) {
      skipped.invalid += 1;
      continue;
    }
    if (bank.some((other) => comparePatterns(other, norm))) {
      skipped.similar += 1;
      continue;
    }
    bank.push(norm);
    taken.push({ start, pattern });
  }
  taken.sort((a, b) => a.start - b.start);
  const patterns = taken.map((t, i) => {
    const renamed = buildPattern(song, t.start, i, plan, catalog);
    if (!renamed) throw new Error('unreachable: a taken window rebuilds');
    return renamed;
  });
  const line = `${song.plan.file} → ${song.plan.era} (${song.keyName}, from ${song.sourceKey}, ×${song.stretch}): ${patterns.length} pattern(s); ${starts.length} window(s) fit the boundary; skipped ${skipped.similar} similar, ${skipped.empty} too sparse, ${skipped.invalid} invalid`;
  return { patterns, line };
}

export function importAll(
  plan: ImportPlan,
  readMidi: (file: string) => MidiFile,
  catalog: MusicCatalog,
): ImportResult {
  const banks = new Map<string, NormalizedPattern[]>();
  const patterns: PatternDocument[] = [];
  const report: string[] = [];
  for (const songPlan of plan.songs) {
    const midi = readMidi(songPlan.file);
    const song = prepare(midi, songPlan, catalog, chooseReading(midi, songPlan, catalog));
    const bank = banks.get(songPlan.era) ?? [];
    banks.set(songPlan.era, bank);
    const result = importSong(song, plan, catalog, bank);
    patterns.push(...result.patterns);
    report.push(result.line);
  }
  for (const s of plan.skipped) report.push(`${s.file}: skipped — ${s.reason}`);
  return { patterns, report };
}
