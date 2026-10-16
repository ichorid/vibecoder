import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { createRun } from './createRun';
import { selectGame } from './selectors';
import { stepRun } from './simulation';
import type { RunState } from './types';

const gone = (run: RunState): RunState => ({
  ...run,
  cat: { ...run.cat, alive: false, health: 0, diedAtActiveMs: 0 },
});

describe('texts about the cat follow the cat', () => {
  it('the local-servers discovery mentions the cat only while it is around', () => {
    const run = createRun(1, 'r');
    const pending: RunState = {
      ...run,
      unlockedTechnologyIds: ['local-servers'],
      pendingUnlockIds: ['local-servers'],
    };
    expect(selectGame(pending, catalog).announcement?.description).toMatch(/has opinions/);
    expect(selectGame(gone(pending), catalog).announcement?.description).toMatch(
      /would have had opinions about it, if the fella was still around/,
    );
  });

  it('the idle-agent line says the cat used to, once it is gone', () => {
    const base = createRun(1, 'r');
    // An agent with nothing to do and no tasks: the "no tasks" line fires.
    const idle = (run: RunState): RunState => ({
      ...run,
      activeMs: 200_000,
      unlockedTechnologyIds: [
        'autocomplete',
        'generated-snippets',
        'ai-native-ide',
        'terminal-agent',
      ],
      narrative: { fired: ['new-project', 'cat-helping'], lastAt: {} },
      economy: { ...run.economy, tasks: 0, tokens: 500 },
    });
    const line = (run: RunState) => {
      let next = run;
      for (let i = 0; i < 50; i += 1) next = stepRun(next, 100, catalog).run;
      return next.log.map((l) => l.text).find((t) => t.includes('staring at the cursor')) ?? '';
    };
    expect(line(idle(base))).toMatch(/like the cat\.$/);
    expect(line(gone(idle(base)))).toMatch(/like the cat used to\.$/);
  });
});
