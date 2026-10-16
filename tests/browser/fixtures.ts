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

import { selectCat } from '../../src/game/selectors';
import { applyCommand } from '../../src/game/commands';

/**
 * Feed (but never pet or play) until mood falls into the requested band, then keep stepping
 * until an intrusion of that size is visible. Command-driven: only time and FEED.
 */
export function lonelyRun(level: 'small' | 'large', seed = 31): RunState {
  let run = createRun(seed, `lonely-${seed}`);
  for (let i = 0; i < 40 * 600; i += 1) {
    if (run.activeMs % 180_000 === 0 && run.cat.fullness < 70) {
      run = applyCommand(run, { type: 'feedCat' }, run.activeMs, catalog).run;
    }
    run = stepRun(run, 100, catalog).run;
    const visible = selectCat(run, catalog).attention.level;
    if (visible === level && run.attention.visibleUntilMs !== null) {
      // Stop early in the window so the reloaded page still shows it.
      if (run.attention.visibleUntilMs - run.activeMs >= 3000) return run;
    }
  }
  throw new Error(`no ${level} intrusion reached`);
}
