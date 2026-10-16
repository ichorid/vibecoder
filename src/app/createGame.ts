import type { Catalog } from '../game/catalog';
import { applyCommand, type CommandResult } from '../game/commands';
import { stepRun } from '../game/simulation';
import type { GameCommand, ReadonlyRun, RunState } from '../game/types';
import { createSnapshotStore, type Readable } from './gameStore';
import { createRuntime, STEP_MS, type IntervalScheduler, type MonotonicClock } from './runtime';

export interface GameSnapshot {
  readonly run: ReadonlyRun;
}

/** The narrow API handed to UI components. No setters, no raw mutable state. */
export interface PublicGameApi extends Readable<GameSnapshot> {
  dispatch(command: GameCommand): CommandResult;
}

export interface GameOptions {
  catalog: Catalog;
  clock: MonotonicClock;
  scheduler: IntervalScheduler;
  run: RunState;
  freezeSnapshots?: boolean;
}

export interface Game {
  readonly api: PublicGameApi;
  readonly runtime: ReturnType<typeof createRuntime>;
  start(): void;
  dispose(): void;
}

export function createGame(options: GameOptions): Game {
  const { catalog } = options;
  let run = options.run;
  const store = createSnapshotStore<GameSnapshot>({ run }, options.freezeSnapshots ?? true);

  const publish = () => store.publish({ run });

  function advance(count: number): void {
    for (let i = 0; i < count; i += 1) run = stepRun(run, STEP_MS, catalog).run;
  }

  const runtime = createRuntime({
    clock: options.clock,
    scheduler: options.scheduler,
    onSteps(count) {
      advance(count);
      if (!dispatching) publish();
    },
  });

  let dispatching = false;

  function dispatch(command: GameCommand): CommandResult {
    dispatching = true;
    try {
      runtime.settle();
      const transition = applyCommand(run, command, run.activeMs + runtime.remainderMs(), catalog);
      run = transition.run;
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
    dispose: () => runtime.dispose(),
  };
}
