import type { Catalog } from '../game/catalog';
import { applyCommand, type CommandResult } from '../game/commands';
import { selectCat, selectGame, selectHistory, selectWorld } from '../game/selectors';
import { selectSetup } from '../game/setup';
import { experienceOf, frugalOf } from '../game/experience';
import { stepRun } from '../game/simulation';
import type { GameCommand, GameFact, ReadonlyRun, RunState } from '../game/types';
import {
  CONTENT_VERSION,
  CURRENT_SCHEMA_VERSION,
  type ProfileState,
  type SaveAdapter,
} from '../persistence/save';
import type {
  AppCommand,
  CheckpointInfo,
  InputTiming,
  SaveStatus,
  UiGameApi,
  UiSnapshot,
} from '../ui/contracts';
import { createSnapshotStore, type Readable } from './gameStore';
import {
  createRuntime,
  STEP_MS,
  type GameRuntime,
  type IntervalScheduler,
  type MonotonicClock,
  type PauseReason,
} from './runtime';

/** Dirty runs are written at least this often (active time). */
export const PERIODIC_SAVE_MS = 5000;

export type { AppCommand, SaveStatus };

/** UI read models plus the committed run for app-level consumers (world, tests). */
export interface GameSnapshot extends UiSnapshot {
  readonly run: ReadonlyRun;
}

/** The narrow API handed to UI components. No setters, no raw mutable state. */
export interface PublicGameApi extends Readable<GameSnapshot> {
  dispatch(command: GameCommand | AppCommand, input?: InputTiming): CommandResult;
}

/** Compile-time proof that the public API satisfies the UI contract. */
export type PublicApiSatisfiesUi = PublicGameApi extends UiGameApi ? true : never;

export interface PersistenceOptions {
  adapter: SaveAdapter;
  profile: ProfileState;
  revision: number;
  /** A second slot for a player-made checkpoint (save here / load it back). */
  checkpoint?: SaveAdapter;
}

export interface GameOptions {
  catalog: Catalog;
  clock: MonotonicClock;
  scheduler: IntervalScheduler;
  run: RunState;
  /** Factory for a deliberate restart (new ID and seed come from the app boundary). */
  /**
   * A fresh run carrying the profile's lessons: experience (code yield) and the frugal rent
   * factor, both derived from earlier endings.
   */
  newRun?: (experience: number, frugal: number) => RunState;
  persistence?: PersistenceOptions;
  freezeSnapshots?: boolean;
  /** App-level listener for committed facts (e.g. care sound effects); never alters the run. */
  onFacts?: (facts: readonly GameFact[]) => void;
}

export interface Game {
  readonly api: PublicGameApi;
  readonly runtime: GameRuntime;
  start(): void;
  /** Settle eligible time, pause for `reason`, and save. */
  suspend(reason: PauseReason): void;
  resume(reason: PauseReason): void;
  /** Current active time including the not-yet-stepped part (presentation only). */
  activeNow(): number;
  isActive(): boolean;
  /** Revision of the last successful write (tab-ownership fallback). */
  revision(): number;
  saveNow(): void;
  dispose(): void;
}

/** Facts that make a write immediate instead of waiting for the periodic save. */
function needsImmediateSave(facts: readonly GameFact[]): boolean {
  return facts.some(
    (fact) =>
      fact.type === 'purchased' ||
      fact.type === 'technologyDiscovered' ||
      fact.type === 'catCared' ||
      fact.type === 'catDied' ||
      fact.type === 'catLeft' ||
      fact.type === 'releaseShipped' ||
      fact.type === 'demoMade' ||
      fact.type === 'demoDesigned' ||
      fact.type === 'endingReached' ||
      fact.type === 'choiceMade',
  );
}

export function createGame(options: GameOptions): Game {
  const { catalog, persistence } = options;
  let run = options.run;
  const loadedProfile: ProfileState = persistence?.profile ?? {
    theme: 'auto',
    endings: [],
    experience: 0,
  };
  // A stored experience is not trusted: it is recomputed from the discovered endings, so a
  // profile inflated by repeated endings normalises on load.
  let profile: ProfileState = {
    ...loadedProfile,
    experience: experienceOf(loadedProfile.endings, catalog),
  };
  let revision = persistence?.revision ?? 0;
  let saveStatus: SaveStatus = persistence ? 'ok' : 'disabled';
  let lastSavedRun: RunState | null = run;
  let lastSaveActiveMs = run.activeMs;

  /** What the checkpoint slot holds (read once, then kept in step with saves). */
  const checkpointInfo = (saved: RunState | null): CheckpointInfo | null =>
    saved
      ? {
          activeMs: saved.activeMs,
          technologies: saved.unlockedTechnologyIds.length,
          ended: saved.status === 'ended',
        }
      : null;
  const readCheckpoint = (): RunState | null => {
    const loaded = persistence?.checkpoint?.load();
    return loaded?.status === 'loaded' ? loaded.save.run : null;
  };
  let checkpoint = checkpointInfo(readCheckpoint());

  const snapshot = (): GameSnapshot => ({
    run,
    game: selectGame(run, catalog, profile.endings),
    history: selectHistory(run, catalog, profile.endings),
    setup: selectSetup(run, catalog),
    cat: selectCat(run, catalog),
    world: selectWorld(run, catalog),
    profile,
    save: { status: saveStatus },
    checkpoint,
  });
  const store = createSnapshotStore<GameSnapshot>(snapshot(), options.freezeSnapshots ?? true);
  const publish = () => store.publish(snapshot());

  function write(): void {
    if (!persistence) return;
    const result = persistence.adapter.write({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      contentVersion: CONTENT_VERSION,
      revision: revision + 1,
      profile,
      run,
    });
    if (result.ok) {
      revision += 1;
      lastSavedRun = run;
      lastSaveActiveMs = run.activeMs;
      saveStatus = 'ok';
    } else {
      saveStatus = 'failed';
    }
  }

  /** Add each newly reached ending to the profile once, in first-discovery order. */
  function recordDiscoveries(facts: readonly GameFact[]): void {
    for (const fact of facts) {
      if (fact.type !== 'endingReached') continue;
      if (profile.endings.some((e) => e.id === fact.id)) continue;
      profile = {
        ...profile,
        endings: [
          ...profile.endings,
          { id: fact.id, runId: run.id, activeMs: run.activeMs, order: profile.endings.length + 1 },
        ],
      };
      // Each lesson ending teaches once: experience is derived from the distinct endings.
      profile = { ...profile, experience: experienceOf(profile.endings, catalog) };
    }
  }

  function saveIfDue(): void {
    if (run !== lastSavedRun && run.activeMs - lastSaveActiveMs >= PERIODIC_SAVE_MS) write();
  }

  let dispatching = false;

  const runtime = createRuntime({
    clock: options.clock,
    scheduler: options.scheduler,
    onSteps(count) {
      let urgent = false;
      for (let i = 0; i < count; i += 1) {
        const transition = stepRun(run, STEP_MS, catalog);
        run = transition.run;
        recordDiscoveries(transition.facts);
        if (transition.facts.length > 0) options.onFacts?.(transition.facts);
        if (needsImmediateSave(transition.facts)) urgent = true;
      }
      if (urgent) write();
      else saveIfDue();
      if (!dispatching) publish();
    },
  });

  function dispatchApp(command: AppCommand): CommandResult {
    switch (command.type) {
      case 'retrySave':
        write();
        break;
      case 'setTheme':
        profile = { ...profile, theme: command.theme };
        write();
        break;
      case 'graphicsPause':
        // Nothing may starve or progress while the player cannot see the world.
        runtime.pause('graphics');
        if (run !== lastSavedRun) write();
        break;
      case 'graphicsResume':
        runtime.resume('graphics');
        break;
      case 'saveCheckpoint': {
        const slot = persistence?.checkpoint;
        if (!slot) return 'unavailable';
        runtime.settle();
        const result = slot.write({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          contentVersion: CONTENT_VERSION,
          revision: 0,
          profile,
          run,
        });
        if (!result.ok) return 'unavailable';
        checkpoint = checkpointInfo(run);
        break;
      }
      case 'loadCheckpoint': {
        const saved = readCheckpoint();
        if (!saved) return 'unavailable';
        runtime.settle();
        // The run comes back; the profile (discovered endings, experience, theme) stays as is.
        run = saved;
        lastSavedRun = null;
        lastSaveActiveMs = run.activeMs;
        write();
        break;
      }
      case 'restart': {
        if (!options.newRun) return 'unavailable';
        runtime.settle();
        run = options.newRun(profile.experience, frugalOf(profile.endings, catalog));
        lastSavedRun = null;
        lastSaveActiveMs = run.activeMs;
        write();
        break;
      }
    }
    publish();
    return 'applied';
  }

  /**
   * Settle elapsed time, then apply the command at its active timestamp. A browser event's
   * monotonic `timeStamp` is mapped into the active clock and clamped to the current active
   * interval, so timing input is judged when it happened, not at the last drawn frame.
   */
  function dispatch(command: GameCommand | AppCommand, input?: InputTiming): CommandResult {
    if (
      command.type === 'retrySave' ||
      command.type === 'setTheme' ||
      command.type === 'restart' ||
      command.type === 'saveCheckpoint' ||
      command.type === 'loadCheckpoint' ||
      command.type === 'graphicsPause' ||
      command.type === 'graphicsResume'
    ) {
      return dispatchApp(command);
    }
    dispatching = true;
    try {
      runtime.settle();
      const lag = input?.timeStamp === undefined ? 0 : runtime.inputLagMs(input.timeStamp);
      const at = Math.max(0, run.activeMs + runtime.remainderMs() - lag);
      const transition = applyCommand(run, command, at, catalog);
      run = transition.run;
      recordDiscoveries(transition.facts);
      if (transition.facts.length > 0) options.onFacts?.(transition.facts);
      if (needsImmediateSave(transition.facts)) write();
      publish();
      return transition.result;
    } finally {
      dispatching = false;
    }
  }

  return {
    api: {
      subscribe: (subscriber) => store.subscribe(subscriber),
      dispatch,
    },
    runtime,
    start: () => runtime.start(),
    suspend(reason) {
      runtime.pause(reason);
      if (run !== lastSavedRun) write();
      publish();
    },
    resume(reason) {
      runtime.resume(reason);
      if (runtime.isActive() && run.catPlay) dispatch({ type: 'resumeCatPlay' });
    },
    activeNow: () => run.activeMs + runtime.pendingMs(),
    isActive: () => runtime.isActive(),
    revision: () => revision,
    saveNow() {
      write();
      publish();
    },
    dispose: () => runtime.dispose(),
  };
}
