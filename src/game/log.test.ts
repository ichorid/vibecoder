import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { act, clickAndSettle } from '../../tests/helpers/run';
import { createRun } from './createRun';
import { appendLog } from './log';
import { selectGame } from './selectors';

describe('event log', () => {
  it('records a discovery line and shows at most five recent lines', () => {
    const run = act(
      clickAndSettle(createRun(1, 'r'), 10, catalog),
      { type: 'buyUpgrade', id: 'autocomplete' },
      catalog,
    );
    expect(selectGame(run, catalog).log.at(-1)?.text).toBe('🔓 Autocomplete unlocked.');
    let long = run;
    for (let i = 0; i < 8; i += 1) long = appendLog(long, `line ${i}`, catalog);
    const shown = selectGame(long, catalog).log.map((e) => e.text);
    expect(shown).toEqual(['line 3', 'line 4', 'line 5', 'line 6', 'line 7']);
  });

  it('keeps at most the memory limit of entries in the run', () => {
    let run = createRun(1, 'r');
    for (let i = 0; i < 80; i += 1) run = appendLog(run, `x${i}`, catalog);
    expect(run.log).toHaveLength(catalog.balance.logMemoryLimit);
    expect(run.log.at(-1)?.text).toBe('x79');
  });
});
