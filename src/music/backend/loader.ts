/**
 * Lazy entry to the Tone backend. Importing Tone creates an AudioContext, so this module is
 * only loaded with `import()` after the player turns sound on.
 */
import * as Tone from 'tone';
import type { LoadedAudio, MusicEngine } from '../public';
import type { MusicBackendPort } from './port';
import { createToneBackend } from './toneBackend';

export type EngineFactory = (backend: MusicBackendPort) => MusicEngine;

export function loadToneAudio(createEngine: EngineFactory): LoadedAudio {
  const backend = createToneBackend(Tone);
  return {
    unlock: () => Tone.start(),
    engine: createEngine(backend),
  };
}

export function contextState(): string {
  return Tone.getContext().state;
}
