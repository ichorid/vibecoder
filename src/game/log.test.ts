import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { act, build, clickAndSettle } from '../../tests/helpers/run';
import { createRun } from './createRun';
import { appendLog } from './log';
import { selectGame } from './selectors';

describe('event log', () => {
  it('records a discovery line; the terminal gets every remembered line (it scrolls)', () => {
    const run = build(clickAndSettle(createRun(1, 'r'), 5, catalog), 'autocomplete', catalog);
    expect(selectGame(run, catalog).log.map((l) => l.text)).toContain('🔓 Autocomplete unlocked.');
    let long = run;
    for (let i = 0; i < 8; i += 1) long = appendLog(long, `line ${i}`, catalog);
    const shown = selectGame(long, catalog).log.map((e) => e.text);
    expect(shown).toEqual(long.log.map((e) => e.text));
    expect(shown.slice(-3)).toEqual(['line 5', 'line 6', 'line 7']);
  });

  it('keeps at most the memory limit of entries in the run', () => {
    let run = createRun(1, 'r');
    for (let i = 0; i < 80; i += 1) run = appendLog(run, `x${i}`, catalog);
    expect(run.log).toHaveLength(catalog.balance.logMemoryLimit);
    expect(run.log.at(-1)?.text).toBe('x79');
  });

  it('the terminal reacts to every purchase and build with one line (discoveries keep their own)', () => {
    const base = createRun(1, 'r');
    const rich: typeof base = {
      ...base,
      unlockedTechnologyIds: [
        'autocomplete',
        'generated-snippets',
        'ai-native-ide',
        'terminal-agent',
        'parallel-agents',
      ],
      upgradeLevels: {
        autocomplete: 1,
        'generated-snippets': 1,
        'ai-native-ide': 1,
        'terminal-agent': 1,
        'parallel-agents': 1,
      },
      economy: { ...base.economy, money: 100_000 },
      narrative: { ...base.narrative, fired: ['first-gig'] },
    };
    const slot = act(rich, { type: 'buyUpgrade', id: 'compute-slot' }, catalog);
    expect(slot.log.at(-1)?.text).toBe('🛒 Bought Compute slot (level 1).');
    const again = act(slot, { type: 'buyUpgrade', id: 'compute-slot' }, catalog);
    expect(again.log.at(-1)?.text).toBe('🛒 Bought Compute slot (level 2).');
    const tokens = act(rich, { type: 'buyUpgrade', id: 'token-supply' }, catalog);
    expect(tokens.log.at(-1)?.text).toMatch(/^🪙 Bought \d+ tokens for \$\d+\.$/);
    const tech = build(rich, 'autonomous-edits', catalog);
    const lines = tech.log.slice(rich.log.length).map((l) => l.text);
    expect(lines).toContain('🔓 Autonomous Edits unlocked.');
    expect(lines.filter((l) => l.startsWith('🛠️ Built:'))).toEqual([]);
    const agent = build(rich, 'additional-agent', catalog);
    expect(agent.log.map((l) => l.text)).toContain('🛠️ Built: Additional agent (level 1).');
  });
});
