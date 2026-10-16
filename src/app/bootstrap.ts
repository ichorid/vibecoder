import { catalog } from '../content/catalog';
import { createRun } from '../game/createRun';
import {
  createProfile,
  createSaveAdapter,
  CURRENT_SCHEMA_VERSION,
  recoverProfile,
  type LoadResult,
  type SaveAdapter,
  type StorageLike,
} from '../persistence/save';
import { selectMusicProjection } from '../game/selectors';
import { createAudioPreferences } from '../music/preferences';
import { createGame, type Game } from './createGame';
import { attachBrowserLifecycle, type LifecycleTarget } from './lifecycle';
import { createMusicBinding, type MusicBinding } from './musicBinding';
import { browserClock, browserScheduler } from './runtime';

/** Seeds and run IDs are created here, at the app boundary, never inside game code. */
export function newSeed(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] ?? 1;
}

export function newRunId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `run-${newSeed().toString(16)}-${newSeed().toString(16)}`;
}

export { illustrationUrl } from './assetUrls';

function browserStorage(): StorageLike | null {
  try {
    const storage = window.localStorage;
    const probe = 'vibe-coder.probe';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export type Boot =
  | { kind: 'ready'; game: Game; music: MusicBinding; detach: () => void }
  | {
      kind: 'recovery';
      load: Extract<LoadResult, { status: 'corrupt' | 'unsupported' }>;
      /** Discovered endings survive a new run only if the old profile validates on its own. */
      keepsEndings: boolean;
      startNew: () => void;
    };

/**
 * Load the save and compose the game. A broken save is never overwritten automatically: the
 * player chooses between retrying and explicitly starting a new run.
 */
export function bootGame(): Boot {
  const storage = browserStorage();
  const adapter: SaveAdapter | null = storage ? createSaveAdapter(storage) : null;
  const loaded: LoadResult = adapter ? adapter.load() : { status: 'empty' };

  if (loaded.status === 'corrupt' || loaded.status === 'unsupported') {
    const recovered = loaded.status === 'corrupt' ? recoverProfile(loaded.raw) : null;
    return {
      kind: 'recovery',
      load: loaded,
      keepsEndings: (recovered?.endings.length ?? 0) > 0,
      startNew: () => {
        adapter?.write({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          contentVersion: 1,
          revision: 0,
          profile: recovered ?? createProfile(),
          run: createRun(newSeed(), newRunId(), recovered?.experience ?? 0),
        });
      },
    };
  }

  const save = loaded.status === 'loaded' ? loaded.save : null;
  const music = createMusicBinding({
    preferences: createAudioPreferences(storage),
    // Tone, the director and the pack load only after the Sound gesture.
    load: async () => (await import('./gameAudio')).loadGameAudio(newSeed()),
    userActivationActive: () => navigator.userActivation?.isActive ?? true,
    now: () => performance.now(),
  });
  const game = createGame({
    onFacts: (facts) => music.facts(facts),
    catalog,
    clock: browserClock,
    scheduler: browserScheduler,
    run: save?.run ?? createRun(newSeed(), newRunId()),
    // A new run starts with the experience earned so far.
    newRun: (experience: number) => createRun(newSeed(), newRunId(), experience),
    ...(adapter
      ? {
          persistence: {
            adapter,
            profile: save?.profile ?? createProfile(),
            revision: save?.revision ?? 0,
          },
        }
      : {}),
    freezeSnapshots: import.meta.env.DEV,
  });
  game.api.subscribe((snapshot) => music.project(selectMusicProjection(snapshot.run)));
  // Background, blur and freeze pause the game and silence music at once; music resumes only
  // when the game is active again. A refused audio resume never holds the game back.
  const lifecycle: LifecycleTarget = {
    isActive: () => game.isActive(),
    suspend(reason) {
      game.suspend(reason);
      music.suspend();
    },
    resume(reason) {
      game.resume(reason);
      if (game.isActive()) music.wake();
    },
  };
  const detachLifecycle = attachBrowserLifecycle(lifecycle, document, window);
  const detachResume = resumeSoundOnFirstGesture(music);
  game.start();
  // A reloaded PLAY attempt continues after the same short ready cue as a resume.
  if (save?.run.catPlay) game.api.dispatch({ type: 'resumeCatPlay' });
  return {
    kind: 'ready',
    game,
    music,
    detach: () => {
      detachLifecycle();
      detachResume();
      music.dispose();
    },
  };
}

/**
 * The player's "Sound on" choice is remembered, but browsers allow audio only after a gesture:
 * a tap or key press restarts it after a reload or an interruption (screen lock, a call). Taps
 * on the Sound switch itself are left to the switch.
 */
function resumeSoundOnFirstGesture(music: MusicBinding): () => void {
  let view = { soundOn: false, status: 'off' };
  const unsubscribe = music.controls.subscribe((v) => (view = v));
  const onGesture = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[role="switch"]')) return;
    if (view.soundOn && (view.status === 'off' || view.status === 'needsGesture')) {
      void music.controls.setSound(true);
    }
  };
  window.addEventListener('pointerdown', onGesture, true);
  window.addEventListener('keydown', onGesture, true);
  return () => {
    window.removeEventListener('pointerdown', onGesture, true);
    window.removeEventListener('keydown', onGesture, true);
    unsubscribe();
  };
}
