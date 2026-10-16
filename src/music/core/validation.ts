/**
 * Semantic music checks (Tonal for pitch/chord/scale parsing). Hard errors make a pattern
 * unplayable; musical warnings are for a human to judge — a passing or chromatic tone is never
 * a hard failure. Nothing here declares a pattern good.
 */
import { Chord, Note, Scale } from 'tonal';
import type { EraDocument, PatternDocument, PresetDocument } from '../data/patterns.generated';
import type { Diagnostic, MusicCatalog } from './catalog';

export const DEFAULT_VELOCITY = 0.8;

export interface NormalizedEvent {
  readonly role: string;
  readonly type: 'note' | 'drum';
  readonly step: number;
  readonly length: number;
  readonly velocity: number;
  /** MIDI note number for pitched events. */
  readonly midi: number | null;
  readonly sound: 'kick' | 'snare' | 'hat' | null;
}

export interface NormalizedPattern {
  readonly id: string;
  readonly revision: number;
  readonly eraId: string;
  readonly bpm: number;
  readonly bars: number;
  readonly stepsPerBar: number;
  readonly timeSignature: { readonly numerator: number; readonly denominator: number };
  readonly totalSteps: number;
  readonly energy: number;
  readonly entryGroup: string;
  readonly exitGroup: string;
  readonly events: readonly NormalizedEvent[];
}

export interface PatternAnalysis {
  readonly diagnostics: readonly Diagnostic[];
  /** Present only when there are no hard errors. */
  readonly normalized: NormalizedPattern | null;
}

function rolePreset(
  catalog: MusicCatalog,
  era: EraDocument | undefined,
  role: string,
): PresetDocument | undefined {
  const arrangement = era ? catalog.arrangements.get(era.defaultArrangement) : undefined;
  const assignment = arrangement?.roles[role];
  return assignment ? catalog.presets.get(assignment.preset) : undefined;
}

export function analyzePattern(pattern: PatternDocument, catalog: MusicCatalog): PatternAnalysis {
  const diagnostics: Diagnostic[] = [];
  const source = `pattern ${pattern.id}@${pattern.revision}`;
  const error = (path: string, message: string) =>
    diagnostics.push({ level: 'error', source, path, message: `${source}: ${path} ${message}` });
  const warn = (path: string, message: string) =>
    diagnostics.push({ level: 'warning', source, path, message: `${source}: ${path} ${message}` });

  const era = catalog.eras.get(pattern.eraId);
  const stepsPerBar = pattern.stepsPerBar ?? era?.defaults.stepsPerBar ?? 16;
  const timeSignature = pattern.timeSignature ??
    era?.defaults.timeSignature ?? { numerator: 4, denominator: 4 };
  const bpm = pattern.bpm ?? era?.defaults.bpm ?? 120;
  const totalSteps = pattern.bars * stepsPerBar;

  const scale = Scale.get(`${pattern.key.tonic} ${pattern.key.mode}`);
  if (scale.empty) error('/key/mode', `unknown mode "${pattern.key.mode}"`);
  const scaleChromas = new Set(scale.notes.map((n) => Note.chroma(n)));

  // Harmony: ordered, contiguous, covering exactly the phrase.
  const spans = [...pattern.harmony].sort((a, b) => a.step - b.step);
  let cursor = 0;
  spans.forEach((span, i) => {
    if (Chord.get(span.chord).empty) error(`/harmony/${i}/chord`, `unknown chord "${span.chord}"`);
    if (span.step < cursor) error(`/harmony/${i}`, 'harmony spans overlap');
    else if (span.step > cursor) error(`/harmony/${i}`, `harmony gap before step ${span.step}`);
    cursor = Math.max(cursor, span.step + span.length);
  });
  if (cursor !== totalSteps) error('/harmony', `harmony covers ${cursor} of ${totalSteps} steps`);
  const chordAt = (step: number) => {
    const span = spans.find((s) => step >= s.step && step < s.step + s.length);
    return span
      ? new Set(Chord.get(span.chord).notes.map((n) => Note.chroma(n)))
      : new Set<number>();
  };

  const events: NormalizedEvent[] = [];
  for (const [role, track] of Object.entries(pattern.tracks)) {
    const preset = rolePreset(catalog, era, role);
    const low = preset?.range ? Note.midi(preset.range.low) : null;
    const high = preset?.range ? Note.midi(preset.range.high) : null;
    (track ?? []).forEach((event, i) => {
      const path = `/tracks/${role}/${i}`;
      if (event.step + event.length > totalSteps)
        error(path, `ends after the pattern end (step ${totalSteps})`);
      const velocity = event.velocity ?? DEFAULT_VELOCITY;
      if (event.type === 'note') {
        const midi = Note.midi(event.pitch);
        if (midi === null) {
          error(`${path}/pitch`, `invalid pitch "${event.pitch}"`);
          return;
        }
        if (preset?.family === 'noise') error(path, `pitched note on percussion role "${role}"`);
        if (low !== null && high !== null && (midi < low || midi > high)) {
          error(`${path}/pitch`, `${event.pitch} outside the ${preset?.id ?? role} range`);
        }
        const chroma = Note.chroma(event.pitch);
        if (!scale.empty && !scaleChromas.has(chroma))
          warn(`${path}/pitch`, `${event.pitch} is outside the key (chromatic)`);
        else if (!chordAt(event.step).has(chroma))
          warn(`${path}/pitch`, `${event.pitch} is a non-chord tone`);
        events.push({
          role,
          type: 'note',
          step: event.step,
          length: event.length,
          velocity,
          midi,
          sound: null,
        });
      } else {
        events.push({
          role,
          type: 'drum',
          step: event.step,
          length: event.length,
          velocity,
          midi: null,
          sound: event.sound,
        });
      }
    });
    // Voice sweep: note-off at a boundary happens before note-on; silent events are not voices.
    const sounding = events.filter((e) => e.role === role && e.velocity > 0 && e.type === 'note');
    const marks = sounding.flatMap((e) => [
      { at: e.step, delta: 1 },
      { at: e.step + e.length, delta: -1 },
    ]);
    marks.sort((a, b) => a.at - b.at || a.delta - b.delta);
    let voices = 0;
    let peak = 0;
    for (const mark of marks) {
      voices += mark.delta;
      peak = Math.max(peak, voices);
    }
    const limit = preset?.polyphony ?? 1;
    if (peak > limit)
      error(`/tracks/${role}`, `polyphony ${peak} exceeds ${limit} (overlapping notes)`);
  }

  if (diagnostics.some((d) => d.level === 'error')) return { diagnostics, normalized: null };
  return {
    diagnostics,
    normalized: {
      id: pattern.id,
      revision: pattern.revision,
      eraId: pattern.eraId,
      bpm,
      bars: pattern.bars,
      stepsPerBar,
      timeSignature,
      totalSteps,
      energy: pattern.energy,
      entryGroup: pattern.boundary.entryGroup,
      exitGroup: pattern.boundary.exitGroup,
      events,
    },
  };
}
