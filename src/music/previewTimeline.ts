/**
 * The evolution preview: a data timeline (stages × phrases) fed to the same director the game
 * uses, advanced on its audio-clock commits — never a wall-clock interval. A stage whose bank is
 * empty plays its declared demo fallback (Lab only) and says so with the true source era.
 */
import { clockFor } from './core/timing';
import type { MusicDirector, PhraseInfo } from './director';
import type { MusicLibrary } from './library';

export interface TimelineStage {
  readonly era: string;
  readonly arrangement: string;
  readonly phrases: number;
}

/** Two phrases per era, each era with its own base arrangement. */
export const EVOLUTION_TIMELINE: readonly TimelineStage[] = [
  { era: 'discovery', arrangement: 'discovery-base', phrases: 2 },
  { era: 'acceleration', arrangement: 'acceleration-base', phrases: 2 },
  { era: 'orchestration', arrangement: 'orchestration-base', phrases: 2 },
  { era: 'recursion', arrangement: 'recursion-base', phrases: 2 },
  { era: 'self-improvement', arrangement: 'self-improvement-base', phrases: 2 },
  { era: 'singularity', arrangement: 'singularity-base', phrases: 2 },
];

export interface TimelineEntry {
  readonly era: string;
  readonly arrangement: string;
  /** The bank the notes come from; null when the stage will be silent. */
  readonly sourceEra: string | null;
  readonly demoFallback: boolean;
  readonly bpm: number;
  readonly startTick: number;
  readonly endTick: number;
}

export interface TimelinePlan {
  readonly entries: readonly TimelineEntry[];
  readonly totalTicks: number;
  readonly durationSeconds: number;
}

function sourceFor(
  library: MusicLibrary,
  eraId: string,
): { era: string | null; fallback: boolean } {
  if (library.bank(eraId).length > 0) return { era: eraId, fallback: false };
  const fallback = library.eras.get(eraId)?.demoFallbackEra;
  if (library.options.demoFallback && fallback && library.bank(fallback).length > 0) {
    return { era: fallback, fallback: true };
  }
  return { era: null, fallback: false };
}

/** Expected schedule; durations follow the source bank's clock (ticks are tempo-independent). */
export function planTimeline(
  stages: readonly TimelineStage[],
  library: MusicLibrary,
  ppq: number,
): TimelinePlan {
  const entries: TimelineEntry[] = [];
  let tick = 0;
  let seconds = 0;
  for (const stage of stages) {
    const source = sourceFor(library, stage.era);
    const clockEra = library.eras.get(source.era ?? stage.era);
    const sample = source.era ? library.bank(source.era)[0] : undefined;
    const bpm = sample?.bpm ?? clockEra?.defaults.bpm ?? 120;
    const clock = clockFor({
      ppq,
      timeSignature: sample?.timeSignature ??
        clockEra?.defaults.timeSignature ?? { numerator: 4, denominator: 4 },
      stepsPerBar: sample?.stepsPerBar ?? clockEra?.defaults.stepsPerBar ?? 16,
      bars: sample?.bars ?? clockEra?.defaults.bars ?? 4,
      bpm,
    });
    const phraseTicks = clock.ok ? clock.phraseTicks : ppq * 16;
    for (let i = 0; i < stage.phrases; i += 1) {
      entries.push({
        era: stage.era,
        arrangement: stage.arrangement,
        sourceEra: source.era,
        demoFallback: source.fallback,
        bpm,
        startTick: tick,
        endTick: tick + phraseTicks,
      });
      tick += phraseTicks;
      seconds += (phraseTicks / ppq) * (60 / bpm);
    }
  }
  return { entries, totalTicks: tick, durationSeconds: seconds };
}

export interface TimelineDriver {
  attach(director: MusicDirector): void;
  /** Pass as the director's `onCommit`: requests the stage of the phrase after the committed one. */
  readonly onCommit: (info: PhraseInfo) => void;
  finished(): boolean;
  /** Index of the phrase most recently committed (−1 before the first). */
  position(): number;
}

/** Era id that has no bank: once the timeline ends, the director falls silent on the boundary. */
const END_OF_TIMELINE = { era: 'end-of-timeline', arrangement: 'none' } as const;

export function createTimelineDriver(stages: readonly TimelineStage[]): TimelineDriver {
  const order = stages.flatMap((stage) =>
    Array.from({ length: stage.phrases }, () => ({
      era: stage.era,
      arrangement: stage.arrangement,
    })),
  );
  let director: MusicDirector | null = null;
  let committed = -1;
  return {
    attach(target) {
      director = target;
      committed = -1;
      target.request(order[0] ?? END_OF_TIMELINE);
    },
    onCommit() {
      committed += 1;
      director?.request(order[committed + 1] ?? END_OF_TIMELINE);
    },
    finished: () => committed >= order.length - 1,
    position: () => committed,
  };
}
