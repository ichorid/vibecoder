import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { build, clickAndSettle } from '../../tests/helpers/run';
import { applyCommand } from './commands';
import { createRun } from './createRun';
import { selectGame } from './selectors';
import type { RunState } from './types';

const gain = (run: RunState) => selectGame(run, catalog).primaryAction.gain;

describe('what one primary press yields (for the floating number)', () => {
  it('WRITE CODE shows the manual output a press adds, including upgrades', () => {
    expect(gain(createRun(1, 'r'))).toEqual({ amount: 1, unit: 'code' });
    let run = clickAndSettle(createRun(1, 'r'), 5, catalog);
    run = build(run, 'autocomplete', catalog);
    expect(gain(run)).toEqual({ amount: 2, unit: 'code' });
  });

  it('matches what the press really added', () => {
    const run = createRun(1, 'r');
    const before = run.economy.pendingManualWork;
    const pressed = applyCommand(run, { type: 'primaryAction' }, 0, catalog).run;
    expect(pressed.economy.pendingManualWork - before).toBe(gain(run)?.amount);
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
