import { catalog } from '../../src/content/catalog';
import { createRun } from '../../src/game/createRun';
import { stepRun } from '../../src/game/simulation';
import type { RunState } from '../../src/game/types';
import { createProfile, encodeSave, CURRENT_SCHEMA_VERSION } from '../../src/persistence/save';

/** Advance a fresh run by ordinary 100 ms steps with no care until the cat starves. */
export function neglectedRun(seed = 21): RunState {
  let run = createRun(seed, `fixture-${seed}`);
  for (let i = 0; i < 40 * 600 && run.cat.alive; i += 1) run = stepRun(run, 100, catalog).run;
  return run;
}

export function saveText(run: RunState): string {
  return encodeSave({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contentVersion: 1,
    revision: 1,
    profile: createProfile(),
    run,
  });
}
