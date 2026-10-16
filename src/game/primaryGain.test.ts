import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { act, AUTOCOMPLETE_PRICE, clickAndSettle, steps } from '../../tests/helpers/run';
import { applyCommand } from './commands';
import { createRun } from './createRun';
import { selectGame } from './selectors';
import type { RunState } from './types';

const gain = (run: RunState) => selectGame(run, catalog).primaryAction.gain;

describe('what one primary press yields (for the floating number)', () => {
  it('WRITE CODE shows the manual output a press adds, including upgrades', () => {
    expect(gain(createRun(1, 'r'))).toEqual({ amount: 1, unit: 'code' });
    let run = clickAndSettle(createRun(1, 'r'), AUTOCOMPLETE_PRICE, catalog);
    run = act(run, { type: 'buyUpgrade', id: 'autocomplete' }, catalog);
    run = steps(run, 5, catalog); // a charge to press with
    expect(gain(run)).toEqual({ amount: 2, unit: 'code' });
  });

  it('matches what the press really added', () => {
    const run = createRun(1, 'r');
    const before = run.economy.pendingManualWork;
    const pressed = applyCommand(run, { type: 'primaryAction' }, 0, catalog).run;
    expect(pressed.economy.pendingManualWork - before).toBe(gain(run)?.amount);
  });

  it('is null when the action budget is spent (the press adds nothing)', () => {
    const run = createRun(1, 'r');
    expect(gain({ ...run, economy: { ...run.economy, actionCharges: 0.5 } })).toBeNull();
  });

  it('describes later actions in their own units', () => {
    const run = createRun(1, 'r');
    const on = (ids: string[]) =>
      ({ ...run, unlockedTechnologyIds: ids, economy: { ...run.economy, debt: 50 } }) as RunState;
    const ids = (last: string) => {
      const all = catalog.technologies.map((t) => t.id);
      return all.slice(0, all.indexOf(last as (typeof all)[number]) + 1);
    };
    expect(gain(on(ids('parallel-agents')))?.unit).toBe('managed');
    expect(gain(on(ids('manager-agent')))).toEqual({ amount: 2, unit: 'debt' });
    expect(gain(on(ids('workflow-optimization')))?.unit).toBe('efficiency');
    expect(gain(on(ids('autonomous-company')))).toBeNull();
  });
});
