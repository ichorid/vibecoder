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
export type AppCommand = { type: 'retrySave' } | { type: 'setTheme'; theme: Theme };

export type UiCommand = GameCommand | AppCommand;

export type CommandOutcome = 'applied' | 'unavailable' | 'unaffordable' | 'cooldown';

export type Dispatch = (command: UiCommand) => CommandOutcome;

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
