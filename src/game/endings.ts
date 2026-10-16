/**
 * Ending resolution. Ending a run is one atomic, idempotent transaction: status, the cat's
 * fate at that moment, one History entry and one fact for app wiring (profile + save).
 */
import type { Catalog, ChoiceDefinition } from './catalog';
import type { EndingId } from './ids';
import type { Transition } from './simulation';
import type { GameFact, ReadonlyRun, RunState } from './types';

export function endRun(run: RunState, id: EndingId): Transition {
  if (run.status !== 'playing') return { run, facts: [] };
  return {
    run: {
      ...run,
      status: 'ended',
      ending: {
        id,
        catAlive: run.cat.alive,
        catLeft: run.cat.leftAtActiveMs !== null,
        activeMs: run.activeMs,
      },
      history: [...run.history, { kind: 'ending', id, activeMs: run.activeMs }],
      catPlay: null,
      attention: { ...run.attention, nextAtMs: null, visibleUntilMs: null, level: null },
    },
    facts: [{ type: 'endingReached', id }],
  };
}

/** Automatic outcomes, evaluated after the cat's update in the same step; highest priority wins. */
export function resolveAutomaticEnding(run: RunState, catalog: Catalog): Transition {
  if (run.status !== 'playing') return { run, facts: [] };
  const candidates = catalog.endings
    .filter((ending) => ending.automatic?.when(run))
    .sort((a, b) => (b.automatic?.priority ?? 0) - (a.automatic?.priority ?? 0));
  const winner = candidates[0];
  return winner ? endRun(run, winner.id) : { run, facts: [] as GameFact[] };
}

/** A choice card is offered when the run plays, it was not taken, and its condition holds. */
export function isChoiceOffered(run: ReadonlyRun, choice: ChoiceDefinition): boolean {
  return run.status === 'playing' && run.choices[choice.id] === undefined && choice.available(run);
}
