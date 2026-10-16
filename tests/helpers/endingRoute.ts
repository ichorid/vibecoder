/**
 * Ending route driver: play from createRun with explicit policies until a choice card is
 * offered in the current read model, then take it through the public command. Never edits
 * state directly; never reads future catalog entries to decide.
 */
import { expect } from 'vitest';
import { catalog } from '../../src/content/catalog';
import { applyCommand } from '../../src/game/commands';
import { createRun } from '../../src/game/createRun';
import type { ChoiceId, EndingId } from '../../src/game/ids';
import { selectGame } from '../../src/game/selectors';
import { stepRun } from '../../src/game/simulation';
import type { RunState } from '../../src/game/types';
import {
  acknowledgeReveals,
  baselineBuyer,
  baselineCare,
  baselinePrimary,
  playEvery,
  type Policy,
} from './scenario';

export const baseline: Policy[] = [
  baselinePrimary,
  baselineBuyer,
  acknowledgeReveals,
  ...baselineCare,
  playEvery(270_000),
];

export function offered(run: RunState, id: ChoiceId): boolean {
  return selectGame(run, catalog).offers.some((o) => o.kind === 'choice' && o.id === id);
}

/** Step with policies until `until` holds (or the time limit passes). */
export function playUntil(
  start: RunState,
  policies: readonly Policy[],
  until: (run: RunState) => boolean,
  limitMs = 50 * 60_000,
): RunState {
  let run = start;
  while (!until(run)) {
    if (run.activeMs >= limitMs)
      throw new Error(`route stalled at ${(run.activeMs / 60_000).toFixed(1)} min`);
    if (run.status !== 'playing') throw new Error(`run ended early: ${run.ending?.id ?? '?'}`);
    for (const policy of policies) {
      for (const command of policy({ run, catalog }))
        run = applyCommand(run, command, run.activeMs, catalog).run;
    }
    run = stepRun(run, 100, catalog).run;
  }
  return run;
}

export function choose(run: RunState, id: ChoiceId): RunState {
  expect(offered(run, id)).toBe(true);
  const result = applyCommand(run, { type: 'choose', id }, run.activeMs, catalog);
  expect(result.result).toBe('applied');
  return result.run;
}

export function playUntilOffered(
  start: RunState,
  policies: readonly Policy[],
  id: ChoiceId,
  limitMs?: number,
) {
  return playUntil(start, policies, (run) => offered(run, id), limitMs);
}

/** Assert a finished route: one ending, one History entry, the text matching the cat. */
export function expectEnding(run: RunState, id: EndingId): void {
  expect(run.status).toBe('ended');
  expect(run.ending?.id).toBe(id);
  expect(run.history.filter((e) => e.kind === 'ending')).toHaveLength(1);
  const view = selectGame(run, catalog).ending;
  const definition = catalog.endings.find((e) => e.id === id);
  expect(view?.paragraphs).toEqual(
    run.ending?.catAlive ? definition?.text.alive : definition?.text.dead,
  );
}

export function newRun(seed = 303): RunState {
  return createRun(seed, `ending-${seed}`);
}

export const has = (run: RunState, id: string) =>
  (run.unlockedTechnologyIds as readonly string[]).includes(id);
