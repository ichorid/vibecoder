import type { Catalog } from '../game/catalog';
import { applyCommand, type CommandResult } from '../game/commands';
import {
  selectGame,
  selectHistory,
  type GameViewModel,
  type HistoryViewModel,
} from '../game/selectors';
import { stepRun } from '../game/simulation';
import type { GameCommand, GameFact, ReadonlyRun, RunState } from '../game/types';
import {
  CONTENT_VERSION,
  CURRENT_SCHEMA_VERSION,
  type ProfileState,
  type SaveAdapter,
  type Theme,
} from '../persistence/save';
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

export type SaveStatus = 'ok' | 'failed' | 'disabled';

/** Commands handled by app composition rather than the simulation. */
export type AppCommand = { type: 'retrySave' } | { type: 'setTheme'; theme: Theme };

export interface GameSnapshot {
  readonly run: ReadonlyRun;
  readonly game: GameViewModel;
  readonly history: HistoryViewModel;
  readonly profile: Readonly<ProfileState>;
  readonly save: { readonly status: SaveStatus };
}

/** The narrow API handed to UI components. No setters, no raw mutable state. */
export interface PublicGameApi extends Readable<GameSnapshot> {
  dispatch(command: GameCommand | AppCommand): CommandResult;
}

export interface PersistenceOptions {
  adapter: SaveAdapter;
  profile: ProfileState;
  revision: number;
}

export interface GameOptions {
  catalog: Catalog;
  clock: MonotonicClock;
  scheduler: IntervalScheduler;
  run: RunState;
  persistence?: PersistenceOptions;
  freezeSnapshots?: boolean;
}

export interface Game {
  readonly api: PublicGameApi;
  readonly runtime: GameRuntime;
  start(): void;
  /** Settle eligible time, pause for `reason`, and save. */
  suspend(reason: PauseReason): void;
  resume(reason: PauseReason): void;
  saveNow(): void;
  dispose(): void;
}

/** Facts that make a write immediate instead of waiting for the periodic save. */
function needsImmediateSave(facts: readonly GameFact[]): boolean {
  return facts.some((fact) => fact.type === 'purchased' || fact.type === 'technologyDiscovered');
}

export function createGame(options: GameOptions): Game {
  const { catalog, persistence } = options;
  let run = options.run;
  let profile: ProfileState = persistence?.profile ?? { theme: 'light' };
  let revision = persistence?.revision ?? 0;
  let saveStatus: SaveStatus = persistence ? 'ok' : 'disabled';
  let lastSavedRun: RunState | null = run;
  let lastSaveActiveMs = run.activeMs;

  const snapshot = (): GameSnapshot => ({
    run,
    game: selectGame(run, catalog),
    history: selectHistory(run, catalog),
    profile,
    save: { status: saveStatus },
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

  function saveIfDue(): void {
    if (run !== lastSavedRun && run.activeMs - lastSaveActiveMs >= PERIODIC_SAVE_MS) write();
  }

  let dispatching = false;

  const runtime = createRuntime({
    clock: options.clock,
    scheduler: options.scheduler,
    onSteps(count) {
      for (let i = 0; i < count; i += 1) run = stepRun(run, STEP_MS, catalog).run;
      saveIfDue();
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
    }
    publish();
    return 'applied';
  }

  function dispatch(command: GameCommand | AppCommand): CommandResult {
    if (command.type === 'retrySave' || command.type === 'setTheme') return dispatchApp(command);
    dispatching = true;
    try {
      runtime.settle();
      const transition = applyCommand(run, command, run.activeMs + runtime.remainderMs(), catalog);
      run = transition.run;
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
    resume: (reason) => runtime.resume(reason),
    saveNow() {
      write();
      publish();
    },
    dispose: () => runtime.dispose(),
  };
}
