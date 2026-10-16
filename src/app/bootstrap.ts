import { assetManifest } from '../content/assets';
import { catalog } from '../content/catalog';
import { createRun } from '../game/createRun';
import {
  createProfile,
  createSaveAdapter,
  type LoadResult,
  type SaveAdapter,
  type StorageLike,
} from '../persistence/save';
import { createGame, type Game } from './createGame';
import { attachBrowserLifecycle } from './lifecycle';
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

const illustrationFiles = new Map<string, string>(
  assetManifest.illustrations.map((asset) => [asset.id, asset.file]),
);

/** Resolve an illustration ID to a URL under the static asset base. */
export function illustrationUrl(illustrationId: string): string | null {
  const file = illustrationFiles.get(illustrationId);
  return file ? `${import.meta.env.BASE_URL}assets/${file}` : null;
}

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
  | { kind: 'ready'; game: Game; detach: () => void }
  | {
      kind: 'recovery';
      load: Extract<LoadResult, { status: 'corrupt' | 'unsupported' }>;
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
    return {
      kind: 'recovery',
      load: loaded,
      startNew: () => {
        adapter?.write({
          schemaVersion: 1,
          contentVersion: 1,
          revision: 0,
          profile: createProfile(),
          run: createRun(newSeed(), newRunId()),
        });
      },
    };
  }

  const save = loaded.status === 'loaded' ? loaded.save : null;
  const game = createGame({
    catalog,
    clock: browserClock,
    scheduler: browserScheduler,
    run: save?.run ?? createRun(newSeed(), newRunId()),
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
  const detach = attachBrowserLifecycle(game.runtime, document, window, () => game.saveNow());
  game.start();
  return { kind: 'ready', game, detach };
}
