/* Generated from music/*.json schemas by tools/music/generateTypes.ts. Do not edit. */
export type Id = string;
export type Step = number;
export type Length = number;
export type Event = NoteEvent | DrumEvent;
export type Velocity = number;

/**
 * One four-bar (by default) chiptune pattern. Steps are grid positions, never milliseconds.
 */
export interface PatternDocument {
  schemaVersion: 1;
  id: Id;
  revision: number;
  eraId: Id;
  bars: number;
  stepsPerBar?: number;
  timeSignature?: {
    numerator: number;
    denominator: 2 | 4 | 8 | 16;
  };
  bpm?: number;
  key: {
    tonic: string;
    mode: string;
  };
  /**
   * @minItems 1
   * @maxItems 64
   */
  harmony: [HarmonySpan, ...HarmonySpan[]];
  energy: number;
  tracks: {
    /**
     * @maxItems 1024
     */
    [k: string]: Event[] | undefined;
  };
  boundary: {
    entryGroup: Id;
    exitGroup: Id;
  };
  motifRef: {
    id: Id;
    revision: number;
  };
  license: 'CC0-1.0' | 'CC-BY-4.0';
  attribution?: string;
  demo: boolean;
  metadata?: {
    description?: string;
    composer?: string;
  };
}
export interface HarmonySpan {
  step: Step;
  length: Length;
  chord: string;
}
export interface NoteEvent {
  type: 'note';
  step: Step;
  length: Length;
  pitch: string;
  velocity?: Velocity;
}
export interface DrumEvent {
  type: 'drum';
  step: Step;
  length: Length;
  sound: 'kick' | 'snare' | 'hat';
  velocity?: Velocity;
}

/**
 * A musical era: defaults and the role → preset arrangement it starts with.
 */
export interface EraDocument {
  schemaVersion: 1;
  id: string;
  revision: number;
  title: string;
  mood: string;
  clockGroup: string;
  defaults: {
    bpm: number;
    bars: number;
    stepsPerBar: number;
    timeSignature: {
      numerator: number;
      denominator: 2 | 4 | 8 | 16;
    };
  };
  key: {
    tonic: string;
    /**
     * @minItems 1
     * @maxItems 4
     */
    modes:
      [string] | [string, string] | [string, string, string] | [string, string, string, string];
  };
  defaultArrangement: string;
  emptyBankPolicy: 'keep-current' | 'silence';
  demoFallbackEra?: string;
}

/**
 * A bounded instrument preset of one of the four synth families. Never raw Tone options.
 */
export interface PresetDocument {
  schemaVersion: 1;
  id: string;
  revision: number;
  family: 'pulse' | 'triangle' | 'arp' | 'noise';
  level: number;
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  range?: {
    low: string;
    high: string;
  };
  polyphony: number;
  pulseWidth?: number;
  detuneCents?: number;
  filterHz?: number;
  distortion?: number;
  fm?: number;
}

/**
 * Which roles sound and with which preset/level. Changes apply at phrase boundaries.
 */
export interface ArrangementDocument {
  schemaVersion: 1;
  id: string;
  revision: number;
  description?: string;
  roles: {
    [k: string]:
      | {
          preset: string;
          level?: number;
          enabled?: boolean;
        }
      | undefined;
  };
}

/**
 * The shared melodic motif, as scale degrees and rhythm (status is honest: demo/pending/approved).
 */
export interface MotifDocument {
  schemaVersion: 1;
  id: string;
  revision: number;
  status: 'demo' | 'pending' | 'approved';
  description?: string;
  /**
   * @minItems 2
   * @maxItems 16
   */
  degrees:
    | [number, number]
    | [number, number, number]
    | [number, number, number, number]
    | [number, number, number, number, number]
    | [number, number, number, number, number, number]
    | [number, number, number, number, number, number, number]
    | [number, number, number, number, number, number, number, number]
    | [number, number, number, number, number, number, number, number, number]
    | [number, number, number, number, number, number, number, number, number, number]
    | [number, number, number, number, number, number, number, number, number, number, number]
    | [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ]
    | [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ]
    | [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ]
    | [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ]
    | [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
  /**
   * @maxItems 16
   */
  rhythmSteps?:
    | []
    | [number]
    | [number, number]
    | [number, number, number]
    | [number, number, number, number]
    | [number, number, number, number, number]
    | [number, number, number, number, number, number]
    | [number, number, number, number, number, number, number]
    | [number, number, number, number, number, number, number, number]
    | [number, number, number, number, number, number, number, number, number]
    | [number, number, number, number, number, number, number, number, number, number]
    | [number, number, number, number, number, number, number, number, number, number, number]
    | [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ]
    | [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ]
    | [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ]
    | [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ]
    | [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
  license: 'CC0-1.0' | 'CC-BY-4.0';
  attribution?: string;
}

/**
 * A human decision about one exact pattern version (id + revision + content hash).
 */
export interface ReviewDocument {
  schemaVersion: 1;
  patternId: string;
  revision: number;
  contentHash: string;
  status: 'unreviewed' | 'approved' | 'revise' | 'rejected';
  rating?: number;
  feedback?: string;
  updatedAt?: string;
}
