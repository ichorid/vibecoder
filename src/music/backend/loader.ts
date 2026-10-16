/**
 * Lazy entry to the Tone backend. Importing Tone creates an AudioContext, so this module is
 * only loaded with `import()` after the player turns sound on.
 */
import * as Tone from 'tone';
import type { LoadedAudio, MusicEngine } from '../public';
import type { MusicBackendPort } from './port';
import { createToneBackend } from './toneBackend';

export type EngineFactory = (backend: MusicBackendPort) => MusicEngine;

/** The context state and its changes (screen lock, calls), observed rather than guessed. */
const contextWatch = {
  contextState: () => Tone.getContext().state as string,
  onContextChange(listener: () => void) {
    const context = Tone.getContext();
    context.on('statechange', listener);
    return () => {
      context.off('statechange', listener);
    };
  },
};

export function loadToneAudio(createEngine: EngineFactory): LoadedAudio {
  const backend = createToneBackend(Tone);
  return {
    unlock: () => Tone.start(),
    engine: createEngine(backend),
    ...contextWatch,
  };
}

/** The raw backend for the Music Lab, which composes its own director over it. */
export function loadToneBackend(): {
  backend: MusicBackendPort;
  unlock: () => Promise<void>;
  contextState: () => string;
  onContextChange: (listener: () => void) => () => void;
} {
  return { backend: createToneBackend(Tone), unlock: () => Tone.start(), ...contextWatch };
}

export function contextState(): string {
  return Tone.getContext().state;
}
