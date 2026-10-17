import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { act, AUTOCOMPLETE_PRICE, clickAndSettle, steps } from '../../tests/helpers/run';
import { applyCommand } from './commands';
import { createRun } from './createRun';

const SEED = 20261016;

describe('WRITE CODE and first builds', () => {
  it('turns one accepted WRITE CODE into +1 code in the original project after the next step', () => {
    const run = clickAndSettle(createRun(SEED, 'r'), 1, catalog);
    expect(run.stats.lifetimeOutput).toBe(1);
    expect(run.projects.release?.code).toBe(1);
    expect(steps(run, 3, catalog).stats.lifetimeOutput).toBe(1);
  });

  it('code cards are built, never bought', () => {
    const run = clickAndSettle(createRun(SEED, 'r'), 9, catalog);
    const result = applyCommand(run, { type: 'buyUpgrade', id: 'autocomplete' }, 0, catalog);
    expect(result.result).toBe('unavailable');
    expect(result.run).toBe(run);
  });

  it('rejects a project that is not currently offered', () => {
    const run = clickAndSettle(createRun(SEED, 'r'), 40, catalog);
    const result = applyCommand(run, { type: 'selectProject', id: 'ai-native-ide' }, 0, catalog);
    expect(result.result).toBe('unavailable');
    expect(result.run).toBe(run);
  });

  it('completes a build at exactly its price and consumes its code', () => {
    let run = clickAndSettle(createRun(SEED, 'r'), 5, catalog);
    run = act(run, { type: 'selectProject', id: 'autocomplete' }, catalog);
    run = clickAndSettle(run, AUTOCOMPLETE_PRICE - 1, catalog);
    expect(run.upgradeLevels.autocomplete).toBeUndefined();
    expect(run.projects.autocomplete?.code).toBe(AUTOCOMPLETE_PRICE - 1);
    run = clickAndSettle(run, 1, catalog);
    expect(run.upgradeLevels.autocomplete).toBe(1);
    expect(run.projects.autocomplete).toBeUndefined();
    expect(run.stats.lifetimeOutput).toBe(5 + AUTOCOMPLETE_PRICE);
  });

  it('cannot build a one-time upgrade twice', () => {
    let run = clickAndSettle(createRun(SEED, 'r'), 5, catalog);
    run = act(run, { type: 'selectProject', id: 'autocomplete' }, catalog);
    run = clickAndSettle(run, AUTOCOMPLETE_PRICE, catalog);
    const again = applyCommand(run, { type: 'selectProject', id: 'autocomplete' }, 0, catalog);
    expect(again.result).toBe('unavailable');
  });
});
