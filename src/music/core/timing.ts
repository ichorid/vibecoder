/**
 * Musical time in whole Tone ticks. A grid that does not divide into whole ticks is an error,
 * never silently rounded. Units: ticks, steps, beats (quarter notes), seconds.
 */
export const DEFAULT_PPQ = 192;

export interface TimeSignature {
  readonly numerator: number;
  readonly denominator: number;
}

export interface ClockInput {
  readonly ppq: number;
  readonly timeSignature: TimeSignature;
  readonly stepsPerBar: number;
  readonly bars: number;
  readonly bpm: number;
}

export type ClockResult =
  | {
      readonly ok: true;
      readonly ticksPerStep: number;
      readonly ticksPerBar: number;
      readonly phraseTicks: number;
      readonly seconds: number;
    }
  | { readonly ok: false; readonly error: string };

export function quarterNotesPerBar(ts: TimeSignature): number {
  return (ts.numerator * 4) / ts.denominator;
}

export function durationSeconds(bars: number, ts: TimeSignature, bpm: number): number {
  return (bars * quarterNotesPerBar(ts) * 60) / bpm;
}

export function clockFor(input: ClockInput): ClockResult {
  const ticksPerBar = input.ppq * quarterNotesPerBar(input.timeSignature);
  if (!Number.isInteger(ticksPerBar)) {
    return {
      ok: false,
      error: `a ${input.timeSignature.numerator}/${input.timeSignature.denominator} bar is not whole ticks at PPQ ${input.ppq}`,
    };
  }
  const ticksPerStep = ticksPerBar / input.stepsPerBar;
  if (!Number.isInteger(ticksPerStep)) {
    return {
      ok: false,
      error: `${input.stepsPerBar} steps per bar are not whole ticks (${ticksPerBar} ticks per bar)`,
    };
  }
  return {
    ok: true,
    ticksPerStep,
    ticksPerBar,
    phraseTicks: ticksPerBar * input.bars,
    seconds: durationSeconds(input.bars, input.timeSignature, input.bpm),
  };
}

/** Where a pattern-level BPM override is allowed (sound plan §3 defaults). */
export type TempoPolicy = 'single-audition' | 'bank' | 'era-boundary';

export function tempoAllowed(policy: TempoPolicy, patternBpm: number, groupBpm: number): boolean {
  switch (policy) {
    case 'single-audition':
    case 'era-boundary':
      return true;
    case 'bank':
      return patternBpm === groupBpm;
  }
}

/** Seconds per tick at a tempo (for converting musical positions to audio time). */
export function secondsPerTick(ppq: number, bpm: number): number {
  return 60 / bpm / ppq;
}
