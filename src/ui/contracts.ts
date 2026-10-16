/**
 * Public contracts between app composition and Svelte views. Views receive read models and a
 * dispatch function; they never see the catalog, simulation, persistence or Pixi.
 */
import type {
  CatViewModel,
  GameViewModel,
  HistoryViewModel,
  WorldViewModel,
} from '../game/selectors';
import type { GameCommand } from '../game/types';

export type Theme = 'light' | 'dark';
export type SaveStatus = 'ok' | 'failed' | 'disabled';
export type ViewId = 'game' | 'history' | 'cat';

/** Commands handled by app composition rather than the simulation. */
export type AppCommand =
  { type: 'retrySave' } | { type: 'setTheme'; theme: Theme } | { type: 'restart' };

export type UiCommand = GameCommand | AppCommand;

export type CommandOutcome = 'applied' | 'unavailable' | 'unaffordable' | 'cooldown';

/** Optional timing of the DOM event that produced the command. */
export interface InputTiming {
  readonly timeStamp?: number;
}

export type Dispatch = (command: UiCommand, input?: InputTiming) => CommandOutcome;

export interface UiSnapshot {
  readonly game: GameViewModel;
  readonly history: HistoryViewModel;
  readonly cat: CatViewModel;
  readonly world: WorldViewModel;
  readonly profile: { readonly theme: Theme };
  readonly save: { readonly status: SaveStatus };
}

export interface Readable<T> {
  subscribe(subscriber: (value: T) => void): () => void;
}

export interface UiGameApi extends Readable<UiSnapshot> {
  dispatch: Dispatch;
}

/** Narrow audio-control contract injected into Settings; the backend arrives with music S07. */
export interface AudioControls {
  /** False until a real audio backend is wired; the UI then says so honestly. */
  readonly available: boolean;
  readonly soundOn: boolean;
  readonly volume: number;
  setSound(on: boolean): void;
  setVolume(volume: number): void;
}

export const unavailableAudio: AudioControls = {
  available: false,
  soundOn: false,
  volume: 0.35,
  setSound() {},
  setVolume() {},
};

/** Presentation clock access for the PLAY track (no gameplay authority). */
export interface PresentationClock {
  /** Current active time in ms, including the not-yet-stepped part. */
  activeNow(): number;
  /** Subscribe to animation frames; returns a disposer. */
  frames(callback: () => void): () => void;
}

/** One sprite-atlas animation for DOM rendering (same frames the world renderer uses). */
export interface DomAnimationView {
  readonly frames: readonly {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  }[];
  readonly frameMs: number;
}

/** The sprite atlas as seen by DOM sprites: image URL, size, and animations by tag. */
export interface DomSpriteSheet {
  readonly imageUrl: string;
  readonly width: number;
  readonly height: number;
  readonly animations: Readonly<Record<string, DomAnimationView>>;
}
