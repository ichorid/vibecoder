/**
 * Narrative events: a short ordered list of predicates evaluated after each step. At most one
 * line per step; once-per-run and cooldown rules prevent repetition; a step that recorded a
 * discovery or the cat's death stays quiet so a joke never crowds out the important line.
 */
import type { Catalog } from './catalog';
import { appendLog } from './log';
import type { GameFact, RunState } from './types';

const PRIORITY_FACTS = new Set<GameFact['type']>(['technologyDiscovered', 'catDied']);

export function evaluateNarrative(
  run: RunState,
  catalog: Catalog,
  facts: readonly GameFact[],
): RunState {
  if (run.status !== 'playing') return run;
  if (facts.some((fact) => PRIORITY_FACTS.has(fact.type))) return run;
  for (const event of catalog.events) {
    if (event.once && run.narrative.fired.includes(event.id)) continue;
    const last = run.narrative.lastAt[event.id];
    if (
      event.cooldownMs !== undefined &&
      last !== undefined &&
      run.activeMs - last < event.cooldownMs
    ) {
      continue;
    }
    if (!event.when(run)) continue;
    let next: RunState = {
      ...run,
      narrative: {
        fired: run.narrative.fired.includes(event.id)
          ? run.narrative.fired
          : [...run.narrative.fired, event.id],
        lastAt: { ...run.narrative.lastAt, [event.id]: run.activeMs },
      },
    };
    if (
      event.significant &&
      !run.history.some((e) => e.kind === 'event' && e.textId === event.id)
    ) {
      next = {
        ...next,
        history: [...next.history, { kind: 'event', textId: event.id, activeMs: run.activeMs }],
      };
    }
    return appendLog(next, event.text, catalog);
  }
  return run;
}

/** Record newly earned achievements once each (History entry; no gameplay effect). */
export function evaluateAchievements(run: RunState, catalog: Catalog): RunState {
  let next = run;
  for (const achievement of catalog.achievements) {
    if (next.achievementIds.includes(achievement.id) || !achievement.when(next)) continue;
    next = {
      ...next,
      achievementIds: [...next.achievementIds, achievement.id],
      history: [
        ...next.history,
        { kind: 'achievement', id: achievement.id, activeMs: next.activeMs },
      ],
    };
  }
  return next;
}
