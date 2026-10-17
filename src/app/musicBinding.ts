/**
 * Game → music composition (sound architecture §6–7). Owns the one audio controller of the game
 * page. It derives the music intent from a compact projection of committed progress (unlocked
 * technology IDs, ended flag, run ID) through `music/binding.json`; it never sees cat state, so
 * a living, hungry or dead cat gives the same soundtrack. Applied care actions may trigger a
 * short, rate-limited sound effect. Tone and the director load only after the Sound gesture.
 */
import bindingJson from '../../music/binding.json';
import { TECHNOLOGY_IDS } from '../game/ids';
import type { MusicProjection } from '../game/selectors';
import type { GameFact } from '../game/types';
import { parseBinding, resolveBinding, type MusicIntent } from '../music/binding';
import type { MusicDirector } from '../music/director';
import type { AudioPreferenceStore } from '../music/preferences';
import { createAudioController, type AudioState, type MusicEngine } from '../music/public';
import type { AudioControls, AudioView } from '../ui/contracts';

export interface GameAudio {
  readonly director: MusicDirector;
  /** Resume the audio context inside the gesture. */
  unlock(): Promise<void>;
  /** Patterns in the loaded pack (0 = no approved soundtrack yet). */
  readonly patterns: number;
  readonly contextState?: () => string;
  readonly onContextChange?: (listener: () => void) => () => void;
}

export interface MusicBindingOptions {
  readonly preferences: AudioPreferenceStore;
  readonly load: () => Promise<GameAudio>;
  readonly userActivationActive: () => boolean;
  /** Monotonic ms for the care-SFX rate limit. */
  readonly now: () => number;
}

export interface MusicBinding {
  readonly controls: AudioControls;
  /** Feed every committed snapshot's projection; cheap when nothing changed. */
  project(projection: MusicProjection): void;
  facts(facts: readonly GameFact[]): void;
  /** Background/blur/freeze: silence now, no catch-up later. */
  suspend(): void;
  wake(): void;
  dispose(): void;
}

/** Minimum gap between care sound effects. */
export const SFX_COOLDOWN_MS = 1200;
const binding = parseBinding(bindingJson);
const sameIntent = (a: MusicIntent | null, b: MusicIntent) =>
  a !== null && a.era === b.era && a.arrangement === b.arrangement;

export function createMusicBinding(options: MusicBindingOptions): MusicBinding {
  let intent: MusicIntent = binding.initial;
  let requested: MusicIntent | null = null;
  let runId: string | null = null;
  let ended = false;
  let director: MusicDirector | null = null;
  let patterns = -1;
  /** The director's transport is running (between start and stop). */
  let running = false;
  let lastSfx = -Infinity;
  let state: AudioState | null = null;
  const subscribers = new Set<(view: AudioView) => void>();

  function view(): AudioView {
    const s = state ?? options.preferences.load();
    const status = state?.status ?? 'off';
    let message = state?.message ?? null;
    if (!message && status === 'playing' && patterns === 0) {
      message = 'No approved soundtrack is installed yet, so the game stays silent.';
    } else if (!message && status === 'playing' && director?.snapshot().status === 'silent') {
      message = 'No approved music for this part of the game yet.';
    } else if (!message && status === 'off' && s.soundOn) {
      message = 'Sound resumes on your next tap.';
    }
    if (status === 'unavailable' || status === 'error') {
      message = `${message ?? 'Sound is unavailable.'} The game continues without sound.`;
    }
    return { available: true, soundOn: s.soundOn, volume: s.volume, status, message };
  }
  const publish = () => {
    const v = view();
    for (const subscriber of subscribers) subscriber(v);
  };

  function applyIntent(): void {
    if (!director || ended || sameIntent(requested, intent)) return;
    requested = intent;
    director.request(intent);
  }

  function startFresh(target: MusicDirector): void {
    requested = null;
    applyIntent();
    target.start();
    running = true;
    if (ended) target.end();
  }

  /** What the controller drives: start/resume start a stopped director fresh. */
  const engine = (target: MusicDirector): MusicEngine => ({
    start: () => startFresh(target),
    pause: () => target.pause(),
    resume: () => (running ? target.resume() : startFresh(target)),
    setVolume: (v) => target.setVolume(v),
    setMuted: (m) => target.setMuted(m),
    dispose: () => target.dispose(),
  });

  const controller = createAudioController({
    preferences: options.preferences,
    userActivationActive: options.userActivationActive,
    onState: (next) => {
      state = next;
      publish();
    },
    loader: async () => {
      const audio = await options.load();
      director = audio.director;
      patterns = audio.patterns;
      return {
        unlock: () => audio.unlock(),
        engine: engine(audio.director),
        ...(audio.contextState ? { contextState: audio.contextState } : {}),
        ...(audio.onContextChange ? { onContextChange: audio.onContextChange } : {}),
      };
    },
  });
  state = controller.state();

  const controls: AudioControls = {
    subscribe(subscriber) {
      subscribers.add(subscriber);
      subscriber(view());
      return () => subscribers.delete(subscriber);
    },
    setSound: (on) => controller.setSound(on),
    setVolume: (volume) => controller.setVolume(volume),
    effect(id) {
      if (director && controller.state().status === 'playing') director.playSfx(id);
    },
  };

  return {
    controls,
    project(projection) {
      if (runId !== null && projection.runId !== runId) {
        // New run: no old pending transition survives; restart from the new projection.
        ended = false;
        requested = null;
        if (director && running) {
          director.stop();
          running = false;
          if (controller.state().status === 'playing') startFresh(director);
        }
      }
      runId = projection.runId;
      intent = resolveBinding(binding, projection.technologyIds, TECHNOLOGY_IDS);
      applyIntent();
      if (projection.ended && !ended) {
        ended = true;
        director?.end();
      }
    },
    facts(facts) {
      if (!director || controller.state().status !== 'playing') return;
      for (const fact of facts) {
        // Care chirps, and a chime when the release (or a demo) is built and waits for SHIP.
        const sfx =
          fact.type === 'catCared'
            ? fact.kind
            : fact.type === 'projectReady'
              ? ('ready' as const)
              : null;
        if (!sfx) continue;
        const at = options.now();
        if (at - lastSfx < SFX_COOLDOWN_MS) continue;
        lastSfx = at;
        director.playSfx(sfx);
      }
    },
    suspend: () => controller.suspend(),
    wake: () => controller.wake(),
    dispose() {
      controller.dispose();
      subscribers.clear();
    },
  };
}
