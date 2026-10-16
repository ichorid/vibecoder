/**
 * Public contracts between app composition and Svelte views. Views receive read models and a
 * dispatch function; they never see the catalog, simulation, persistence or Pixi.
 */
import type { SetupViewModel } from '../game/setup';
import type {
  CatViewModel,
  GameViewModel,
  HistoryViewModel,
  WorldViewModel,
} from '../game/selectors';
import type { GameCommand } from '../game/types';

/** The colours actually shown. */
export type Theme = 'light' | 'dark';
/** What the player chose in Settings; `auto` follows the system. */
export type ThemePreference = 'auto' | Theme;
export type SaveStatus = 'ok' | 'failed' | 'disabled';
export type ViewId = 'game' | 'history' | 'cat' | 'setup';

/** Commands handled by app composition rather than the simulation. */
export type AppCommand =
  | { type: 'retrySave' }
  | { type: 'setTheme'; theme: ThemePreference }
  | { type: 'restart' }
  /** A separate save slot to try something and come back (e.g. every ending in one run). */
  | { type: 'saveCheckpoint' }
  | { type: 'loadCheckpoint' }
  /** The world's graphics context was lost / is back: pause and resume the simulation. */
  | { type: 'graphicsPause' }
  | { type: 'graphicsResume' };

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
  readonly setup: SetupViewModel;
  readonly cat: CatViewModel;
  readonly world: WorldViewModel;
  readonly profile: { readonly theme: ThemePreference };
  readonly save: { readonly status: SaveStatus };
  /** The checkpoint slot (null: empty or not available). */
  readonly checkpoint: CheckpointInfo | null;
}

export interface CheckpointInfo {
  /** Active time of the saved run. */
  readonly activeMs: number;
  readonly technologies: number;
  readonly ended: boolean;
}

export interface Readable<T> {
  subscribe(subscriber: (value: T) => void): () => void;
}

export interface UiGameApi extends Readable<UiSnapshot> {
  dispatch: Dispatch;
}

export type AudioStatus = 'off' | 'loading' | 'needsGesture' | 'playing' | 'unavailable' | 'error';

/** What Settings shows about sound: the player's choice, the real state, and honest notes. */
export interface AudioView {
  /** False when this build has no audio at all; the UI then says so. */
  readonly available: boolean;
  readonly soundOn: boolean;
  readonly volume: number;
  readonly status: AudioStatus;
  /** Why there is no sound, or what the player can do (null when nothing to say). */
  readonly message: string | null;
}

/** Narrow audio-control contract injected into Settings (a readable store plus two actions). */
export interface AudioControls extends Readable<AudioView> {
  /** Called from the Sound switch (a trusted gesture). Never rejects. */
  setSound(on: boolean): Promise<void>;
  setVolume(volume: number): void;
  /** A short presentation sound (release wheel); silent when sound is off. */
  effect?(id: WheelSound): void;
}

/** Sounds the release wheel drives itself, so they match the animation. */
export type WheelSound = 'tick' | 'release' | 'jackpot';

const UNAVAILABLE_VIEW: AudioView = {
  available: false,
  soundOn: false,
  volume: 0.35,
  status: 'unavailable',
  message: null,
};

export const unavailableAudio: AudioControls = {
  subscribe(subscriber) {
    subscriber(UNAVAILABLE_VIEW);
    return () => {};
  },
  setSound: () => Promise.resolve(),
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
