import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { steps } from '../../tests/helpers/run';
import { applyCommand } from './commands';
import { createRun } from './createRun';
import { selectHistory } from './selectors';
import { stepRun } from './simulation';
import type { GameFact, RunState } from './types';

function nearDeath(): RunState {
  const run = createRun(4, 'r');
  return {
    ...run,
    activeMs: 60_000,
    cat: { ...run.cat, fullness: 0, health: 0.5, needsElapsedMs: 4900 },
  };
}

function stepUntilDeath(run: RunState): { run: RunState; facts: GameFact[] } {
  let current = run;
  const facts: GameFact[] = [];
  for (let i = 0; i < 100 && current.cat.alive; i += 1) {
    const t = stepRun(current, 100, catalog);
    current = t.run;
    facts.push(...t.facts);
  }
  return { run: current, facts };
}

describe('cat death transaction', () => {
  it('records death once: flag, time, one history entry, one log line, one save fact', () => {
    const { run, facts } = stepUntilDeath(nearDeath());
    expect(run.cat.alive).toBe(false);
    expect(run.cat.health).toBe(0);
    expect(run.cat.diedAtActiveMs).toBe(60_100);
    expect(run.history.filter((e) => e.kind === 'cat')).toHaveLength(1);
    expect(run.log.filter((l) => l.text === '🕯️ The cat is gone.')).toHaveLength(1);
    expect(facts.filter((f) => f.type === 'catDied')).toHaveLength(1);
    expect(selectHistory(run, catalog).entries.at(-1)?.title).toBe('The cat is gone.');
  });

  it('does not repeat the death event on later ticks', () => {
    const dead = stepUntilDeath(nearDeath()).run;
    const later = steps(dead, 200, catalog);
    expect(later.history.filter((e) => e.kind === 'cat')).toHaveLength(1);
    expect(later.log.filter((l) => l.text === '🕯️ The cat is gone.')).toHaveLength(1);
    expect(later.cat.health).toBe(0);
  });

  it('keeps the economy running after death', () => {
    const dead = stepUntilDeath(nearDeath()).run;
    const clicked = applyCommand(dead, { type: 'primaryAction' }, dead.activeMs, catalog);
    expect(clicked.result).toBe('applied');
    expect(steps(clicked.run, 1, catalog).economy.output).toBe(1);
  });

  it('rejects all care after death without consuming randomness', () => {
    const dead = stepUntilDeath(nearDeath()).run;
    for (const type of ['feedCat', 'petCat'] as const) {
      const result = applyCommand(dead, { type }, dead.activeMs + 5000, catalog);
      expect(result.result).toBe('unavailable');
      expect(result.run.rng).toEqual(dead.rng);
    }
  });
});
