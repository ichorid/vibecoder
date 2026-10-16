/**
 * The narrow public audio API used by Game settings and Music Lab. It lazy-loads the Tone
 * backend only after the player turns sound on, reports honest states, and never throws into
 * the game: a refused or missing audio context just means "no sound".
 */
import type { AudioPreferenceStore } from './preferences';

export type AudioStatus = 'off' | 'loading' | 'needsGesture' | 'playing' | 'unavailable' | 'error';

export interface AudioState {
  readonly status: AudioStatus;
  /** The player's choice (persisted). */
  readonly soundOn: boolean;
  readonly volume: number;
  readonly message: string | null;
}

/** What a loaded music engine exposes to the controller (implemented by the director). */
export interface MusicEngine {
  start(): void;
  pause(): void;
  resume(): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

export interface LoadedAudio {
  /** Resume/start the audio context; must be called inside a trusted gesture. */
  unlock(): Promise<void>;
  readonly engine: MusicEngine;
  /** The audio context's state ('running', 'suspended', 'interrupted', 'closed'). */
  readonly contextState?: () => string;
  /** Called when the OS or browser changes the context state (screen lock, calls). */
  readonly onContextChange?: (listener: () => void) => () => void;
}

export type AudioLoader = () => Promise<LoadedAudio>;

export interface AudioControllerOptions {
  readonly loader: AudioLoader;
  readonly preferences: AudioPreferenceStore;
  /** Whether the current task still has transient user activation (navigator.userActivation). */
  readonly userActivationActive: () => boolean;
  readonly onState: (state: AudioState) => void;
}

export interface AudioController {
  state(): AudioState;
  /** Called from the sound switch (a trusted gesture). Resolves; never rejects. */
  setSound(on: boolean): Promise<void>;
  setVolume(volume: number): void;
  /** Start loading the module early (e.g. when the music settings open) without playing. */
  preload(): void;
  /** Background/foreground: pause and resume without catch-up. */
  suspend(): void;
  wake(): void;
  /** The loaded engine, if any (for app bindings such as era changes). */
  engine(): MusicEngine | null;
  dispose(): void;
}

export function createAudioController(options: AudioControllerOptions): AudioController {
  const prefs = options.preferences.load();
  let soundOn = prefs.soundOn;
  let volume = prefs.volume;
  let status: AudioStatus = 'off';
  let message: string | null = null;
  let loaded: LoadedAudio | null = null;
  let loading: Promise<LoadedAudio | null> | null = null;
  let started = false;
  let suspended = false;
  let disposed = false;
  let stopWatching: () => void = () => {};

  const INTERRUPTED = 'Sound was interrupted. Tap the sound switch to resume it.';
  const contextRunning = () => (loaded?.contextState?.() ?? 'running') === 'running';

  /** Visibility and context state are separate inputs: a stopped context needs a gesture. */
  function onContextChange(): void {
    if (disposed || !soundOn || suspended) return;
    if (status === 'playing' && !contextRunning()) {
      status = 'needsGesture';
      message = INTERRUPTED;
      publish();
    } else if (status === 'needsGesture' && message === INTERRUPTED && contextRunning()) {
      status = 'playing';
      message = null;
      publish();
    }
  }

  const snapshot = (): AudioState => ({ status, soundOn, volume, message });
  const publish = () => options.onState(snapshot());
  const persist = () => options.preferences.save({ schemaVersion: 1, soundOn, volume });

  function load(): Promise<LoadedAudio | null> {
    loading ??= options.loader().then(
      (audio) => {
        if (disposed) {
          audio.engine.dispose();
          return null;
        }
        loaded = audio;
        audio.engine.setVolume(volume);
        stopWatching = audio.onContextChange?.(onContextChange) ?? (() => {});
        return audio;
      },
      (error: unknown) => {
        status = 'unavailable';
        message = `Sound could not load: ${String(error)}`;
        publish();
        return null;
      },
    );
    return loading;
  }

  async function play(audio: LoadedAudio): Promise<void> {
    try {
      await audio.unlock();
    } catch {
      status = 'needsGesture';
      message = 'Tap the sound switch again to start audio.';
      publish();
      return;
    }
    if (!soundOn || disposed) return;
    try {
      audio.engine.setMuted(false);
      if (!started) {
        audio.engine.start();
        started = true;
      } else {
        audio.engine.resume();
      }
      status = suspended ? 'off' : 'playing';
      message = null;
    } catch (error) {
      status = 'error';
      message = `Sound failed: ${String(error)}`;
    }
    publish();
  }

  return {
    state: snapshot,
    async setSound(on) {
      soundOn = on;
      persist();
      if (!on) {
        loaded?.engine.setMuted(true);
        if (started) loaded?.engine.pause();
        status = 'off';
        message = null;
        publish();
        return;
      }
      if (loaded) {
        await play(loaded);
        return;
      }
      status = 'loading';
      publish();
      const audio = await load();
      if (!audio) return;
      // An `await` can outlive the click's user activation (notably on iOS): ask again.
      if (!options.userActivationActive()) {
        status = 'needsGesture';
        message = 'Sound is ready. Tap the switch once more to start it.';
        publish();
        return;
      }
      await play(audio);
    },
    setVolume(next) {
      volume = Math.min(1, Math.max(0, next));
      loaded?.engine.setVolume(volume);
      persist();
      publish();
    },
    preload() {
      void load();
    },
    suspend() {
      suspended = true;
      if (started && soundOn) loaded?.engine.pause();
    },
    wake() {
      if (!suspended) return;
      suspended = false;
      if (!started || !soundOn) return;
      loaded?.engine.resume();
      if (!contextRunning()) {
        status = 'needsGesture';
        message = INTERRUPTED;
        publish();
      }
    },
    engine: () => loaded?.engine ?? null,
    dispose() {
      if (disposed) return;
      disposed = true;
      stopWatching();
      loaded?.engine.dispose();
      loaded = null;
    },
  };
}
