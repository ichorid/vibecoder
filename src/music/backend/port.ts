/**
 * The audio backend contract the director uses. Only `toneBackend.ts` implements it with Tone;
 * tests use a fake with the same lookahead semantics. No Tone types leak through this file.
 */
import type { PresetDocument } from '../data/patterns.generated';
import type { PhrasePlan } from '../core/phrasePlanner';

export interface PhraseHandle {
  readonly id: number;
  readonly key: string;
  readonly startTick: number;
  readonly endTick: number;
}

export interface BackendDiagnostics {
  readonly scheduledEvents: number;
  readonly liveVoices: number;
  readonly instruments: number;
  readonly phrases: number;
}

export type TransportState = 'stopped' | 'started' | 'paused';

export interface MusicBackendPort {
  readonly ppq: number;
  loadPresets(presets: readonly PresetDocument[]): void;
  /**
   * Schedule all events of a phrase at absolute ticks. `onCommit` runs on the audio clock's
   * lookahead when the phrase can no longer be replaced (drives scheduling; never depends on
   * animation frames). `onAudible` fires through the draw queue when the phrase actually starts
   * sounding (UI only; may never fire offline or in a hidden tab).
   */
  schedulePhrase(
    plan: PhrasePlan,
    onAudible: (plan: PhrasePlan) => void,
    onCommit?: (plan: PhrasePlan) => void,
  ): PhraseHandle;
  /** True once the phrase's start callback ran (lookahead): it can no longer be replaced. */
  isCommitted(handle: PhraseHandle): boolean;
  cancelPhrase(handle: PhraseHandle): void;
  setTempo(bpm: number): void;
  positionTicks(): number;
  state(): TransportState;
  start(): void;
  /** Keep the musical position; silence and release voices; cancel queued audio. */
  pause(): void;
  resume(): void;
  /** Reset the position to 0 and clear every scheduled phrase. */
  stop(): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  playSfx(id: SfxId): void;
  dispose(): void;
  diagnostics(): BackendDiagnostics;
}

/** Allowlisted short sound effects (explicit care actions only; never mood/health alerts). */
export const SFX_IDS = ['feed', 'pet', 'play', 'tick', 'release', 'jackpot', 'ready'] as const;
export type SfxId = (typeof SFX_IDS)[number];
