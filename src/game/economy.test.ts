import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { act, clickAndSettle, steps } from '../../tests/helpers/run';
import { applyCommand } from './commands';
import { createRun } from './createRun';

const SEED = 20261016;

describe('WRITE CODE and first purchases', () => {
  it('turns one accepted WRITE CODE into +1 output after the next step', () => {
    const run = clickAndSettle(createRun(SEED, 'r'), 1, catalog);
    expect(run.economy.output).toBe(1);
    expect(steps(run, 3, catalog).economy.output).toBe(1);
  });

  it('rejects an unaffordable visible purchase without changing balances', () => {
    const run = clickAndSettle(createRun(SEED, 'r'), 9, catalog);
    const result = applyCommand(run, { type: 'buyUpgrade', id: 'autocomplete' }, 0, catalog);
    expect(result.result).toBe('unaffordable');
    expect(result.run).toBe(run);
  });

  it('rejects a purchase that is not currently offered', () => {
    const run = clickAndSettle(createRun(SEED, 'r'), 40, catalog);
    const result = applyCommand(run, { type: 'buyUpgrade', id: 'ai-native-ide' }, 0, catalog);
    expect(result.result).toBe('unavailable');
    expect(result.run.economy.output).toBe(40);
  });

  it('accepts a purchase at exactly its price and keeps lifetime output', () => {
    const run = clickAndSettle(createRun(SEED, 'r'), 10, catalog);
    const result = applyCommand(run, { type: 'buyUpgrade', id: 'autocomplete' }, 0, catalog);
    expect(result.result).toBe('applied');
    expect(result.run.economy.output).toBe(0);
    expect(result.run.stats.lifetimeOutput).toBe(10);
    expect(result.run.upgradeLevels.autocomplete).toBe(1);
  });

  it('cannot buy a one-time upgrade twice', () => {
    let run = clickAndSettle(createRun(SEED, 'r'), 25, catalog);
    run = act(run, { type: 'buyUpgrade', id: 'autocomplete' }, catalog);
    const again = applyCommand(run, { type: 'buyUpgrade', id: 'autocomplete' }, 0, catalog);
    expect(again.result).toBe('unavailable');
    expect(again.run.economy.output).toBe(15);
  });
});
