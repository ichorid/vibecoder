import { updateAttention, updateCat } from './cat';
import { advanceSession, sessionOf, withSession } from './catPlaySession';
import type { Catalog } from './catalog';
import { deriveRates, roundAmount, stepEconomy } from './economy';
import { appendLog } from './log';
import { evaluateNarrative } from './narrative';
import type { GameFact, RunState } from './types';

export interface Transition {
  readonly run: RunState;
  readonly facts: readonly GameFact[];
}

/**
 * One fixed simulation step, applied in the architecture's order:
 * 1. active time, 2. production, (3. cat, 4. progression, 5. narrative/endings added later),
 * 6. facts for presentation. Never mutates its input.
 */
export function stepRun(run: RunState, stepMs: number, catalog: Catalog): Transition {
  if (run.status !== 'playing') return { run, facts: [] };
  const facts: GameFact[] = [];
  const activeMs = run.activeMs + stepMs;

  // 2. Production, costs and capacity constraints.
  const economy = stepEconomy(run.economy, deriveRates(run, catalog), stepMs, catalog.balance);
  let next: RunState = {
    ...run,
    activeMs,
    economy: economy.economy,
    stats: {
      ...run.stats,
      lifetimeOutput: roundAmount(run.stats.lifetimeOutput + economy.produced),
    },
  };

  // 3. Cat needs, health and terminal death.
  const cat = updateCat(next.cat, stepMs, catalog.balance.cat);
  next = { ...next, cat: cat.cat };
  if (cat.events.some((event) => event.type === 'died')) next = recordDeath(next, catalog, facts);
  else if (next.catPlay) {
    next = withSession(next, advanceSession(sessionOf(next), activeMs, catalog.balance.catPlay));
  }
  // 5. Narrative events (quiet when something important happened this step).
  next = evaluateNarrative(next, catalog, facts);
  const attention = updateAttention(next.attention, next.cat, activeMs, catalog.balance.attention);
  if (attention !== next.attention) next = { ...next, attention };

  return { run: next, facts };
}

/** Atomic death transaction: death time, one History entry, one understated log line. */
function recordDeath(run: RunState, catalog: Catalog, facts: GameFact[]): RunState {
  facts.push({ type: 'catDied' });
  const dead: RunState = {
    ...run,
    cat: { ...run.cat, alive: false, health: 0, diedAtActiveMs: run.activeMs },
    catPlay: null,
    history: [...run.history, { kind: 'cat', id: 'cat-died', activeMs: run.activeMs }],
  };
  return appendLog(dead, catalog.catText.conditions.dead, catalog);
}
