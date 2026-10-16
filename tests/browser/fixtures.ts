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
    if (run.activeMs % CARE.feedMs === 0 && run.cat.fullness < 70) {
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

/** Save outside a PLAY session, so a reloaded page opens on Game (not on Cat). */
function outsidePlay(run: RunState): RunState {
  return run.catPlay ? applyCommand(run, { type: 'leaveCatPlay' }, run.activeMs, catalog).run : run;
}

/** Feed (but never pet or play) until the ignored cat leaves as a stray. */
export function strayRun(seed = 33): RunState {
  let run = createRun(seed, `stray-${seed}`);
  for (let i = 0; i < 40 * 600 && run.cat.alive; i += 1) {
    if (run.activeMs % CARE.feedMs === 0 && run.cat.fullness < 70) {
      run = applyCommand(run, { type: 'feedCat' }, run.activeMs, catalog).run;
    }
    run = stepRun(run, 100, catalog).run;
  }
  if (run.cat.leftAtActiveMs === null) throw new Error('the cat never left');
  return run;
}

import { selectGame } from '../../src/game/selectors';

/**
 * Play the ordinary loop (one click per second, buy the first affordable offer, acknowledge
 * reveals, feed/pet/PLAY on the baseline schedule) until `count` technologies are unlocked.
 * `leavePending` stops right after the last purchase so its reveal is still pending.
 */
export function progressedRun(count: number, leavePending = false, seed = 41): RunState {
  let run = createRun(seed, `progress-${seed}`);
  const play = playEvery();
  for (let i = 0; i < 60 * 600; i += 1) {
    if (run.pendingUnlockIds.length > 0) {
      if (leavePending && run.unlockedTechnologyIds.length >= count) return outsidePlay(run);
      const id = run.pendingUnlockIds[0];
      if (id) run = applyCommand(run, { type: 'acknowledgeUnlock', id }, run.activeMs, catalog).run;
    }
    if (run.unlockedTechnologyIds.length >= count) return outsidePlay(run);
    if (run.activeMs % 1000 === 0) {
      run = applyCommand(run, { type: 'primaryAction' }, run.activeMs, catalog).run;
    }
    const offer = selectGame(run, catalog).offers.find((o) => o.kind === 'upgrade' && o.affordable);
    if (offer?.kind === 'upgrade') {
      run = applyCommand(run, { type: 'buyUpgrade', id: offer.id }, run.activeMs, catalog).run;
    }
    if (run.activeMs % CARE.feedMs === 0 && run.cat.fullness < 70) {
      run = applyCommand(run, { type: 'feedCat' }, run.activeMs, catalog).run;
    }
    if (run.activeMs % CARE.petMs === CARE.petMs / 2) {
      run = applyCommand(run, { type: 'petCat' }, run.activeMs, catalog).run;
    }
    for (const command of play({ run, catalog })) {
      run = applyCommand(run, command, run.activeMs, catalog).run;
    }
    run = stepRun(run, 100, catalog).run;
  }
  throw new Error(`could not reach ${count} technologies`);
}

import type { ChoiceId } from '../../src/game/ids';
import type { DiscoveredEnding } from '../../src/game/types';
import {
  acknowledgeReveals,
  baselineBuyer,
  baselineCare,
  baselinePrimary,
  playEvery,
  CARE,
} from '../helpers/scenario';

/** Play the baseline route until a decision card is offered (command-driven fixture). */
export function untilChoice(id: ChoiceId, seed = 51): RunState {
  let run = createRun(seed, `choice-${seed}`);
  const policies = [
    baselinePrimary,
    baselineBuyer,
    acknowledgeReveals,
    ...baselineCare,
    playEvery(),
  ];
  for (let i = 0; i < 60 * 600; i += 1) {
    if (selectGame(run, catalog).offers.some((o) => o.kind === 'choice' && o.id === id)) {
      // Save outside a PLAY session, so the reloaded page opens on Game.
      return run.catPlay
        ? applyCommand(run, { type: 'leaveCatPlay' }, run.activeMs, catalog).run
        : run;
    }
    for (const policy of policies) {
      for (const command of policy({ run, catalog }))
        run = applyCommand(run, command, run.activeMs, catalog).run;
    }
    run = stepRun(run, 100, catalog).run;
  }
  throw new Error(`choice ${id} never offered`);
}

export function saveWithProfile(run: RunState, endings: DiscoveredEnding[]): string {
  return encodeSave({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contentVersion: 1,
    revision: 1,
    profile: { ...createProfile(), endings },
    run,
  });
}
