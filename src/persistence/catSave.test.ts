import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { steps } from '../../tests/helpers/run';
import { applyCommand } from '../game/commands';
import { createRun } from '../game/createRun';
import { selectWorld } from '../game/selectors';
import { stepRun } from '../game/simulation';
import type { RunState } from '../game/types';
import { decodeRun } from './save';

const roundtrip = (run: RunState) => decodeRun(JSON.parse(JSON.stringify(run)));

describe('cat facts survive saving', () => {
  it('keeps the PET cooldown through a save roundtrip', () => {
    const run = applyCommand(createRun(1, 'r'), { type: 'petCat' }, 0, catalog).run;
    expect(applyCommand(roundtrip(run), { type: 'petCat' }, 1000, catalog).result).toBe('cooldown');
  });

  it('keeps a starved cat dead with no world cat after reload', () => {
    const base = createRun(4, 'r');
    let run: RunState = {
      ...base,
      cat: { ...base.cat, fullness: 0, health: 0.5, needsElapsedMs: 4900 },
    };
    while (run.cat.alive) run = stepRun(run, 100, catalog).run;
    const reloaded = roundtrip(run);
    expect(reloaded.cat.alive).toBe(false);
    expect(selectWorld(reloaded, catalog).cat.alive).toBe(false);
    expect(steps(reloaded, 100, catalog).cat.alive).toBe(false);
  });
});
