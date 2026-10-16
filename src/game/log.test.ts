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

  it('the terminal reacts to every purchase with one line (discoveries keep their own)', () => {
    const base = createRun(1, 'r');
    const rich: typeof base = {
      ...base,
      unlockedTechnologyIds: [
        'autocomplete',
        'generated-snippets',
        'ai-native-ide',
        'terminal-agent',
      ],
      upgradeLevels: {
        autocomplete: 1,
        'generated-snippets': 1,
        'ai-native-ide': 1,
        'terminal-agent': 1,
      },
      economy: { ...base.economy, output: 100_000 },
    };
    const slot = act(rich, { type: 'buyUpgrade', id: 'compute-slot' }, catalog);
    expect(slot.log.at(-1)?.text).toBe('🛒 Bought Compute slot (level 1).');
    const again = act(slot, { type: 'buyUpgrade', id: 'compute-slot' }, catalog);
    expect(again.log.at(-1)?.text).toBe('🛒 Bought Compute slot (level 2).');
    const tokens = act(rich, { type: 'buyUpgrade', id: 'token-supply' }, catalog);
    expect(tokens.log.at(-1)?.text).toMatch(/^🪙 Bought \d+ tokens for \d+ code\.$/);
    const tech = act(rich, { type: 'buyUpgrade', id: 'autonomous-edits' }, catalog);
    expect(tech.log.slice(rich.log.length).map((l) => l.text)).toEqual([
      '🔓 Autonomous Edits unlocked.',
    ]);
  });
});
