import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { act, steps } from '../../tests/helpers/run';
import type { Catalog, ChoiceDefinition, EndingDefinition } from './catalog';
import { applyCommand } from './commands';
import { createRun } from './createRun';
import { selectGame } from './selectors';
import { stepRun } from './simulation';
import type { RunState } from './types';

const text = { alive: ['Alive.'], dead: ['Gone.'], stray: ['Left.'] };
const endingA: EndingDefinition = { id: 'three-users', title: 'A', text };
const endingB: EndingDefinition = { id: 'the-last-programmer', title: 'B', text };

const finish: ChoiceDefinition = {
  id: 'ship-original',
  title: 'Finish',
  description: 'Ends the run.',
  confirm: 'Really?',
  available: () => true,
  ends: 'three-users',
};

function testCatalog(overrides: Partial<Catalog> = {}): Catalog {
  return { ...catalog, choices: [finish], endings: [endingA, endingB], ...overrides };
}

describe('ending resolver', () => {
  it('offers the choice among current cards and ends the run atomically when chosen', () => {
    const cat = testCatalog();
    const run = createRun(1, 'r');
    expect(
      selectGame(run, cat).offers.some((o) => o.kind === 'choice' && o.id === 'ship-original'),
    ).toBe(true);
    const ended = applyCommand(run, { type: 'choose', id: 'ship-original' }, 0, cat);
    expect(ended.result).toBe('applied');
    expect(ended.run.status).toBe('ended');
    expect(ended.run.ending).toEqual({
      id: 'three-users',
      catAlive: true,
      catLeft: false,
      activeMs: 0,
    });
    expect(ended.run.history.filter((e) => e.kind === 'ending')).toHaveLength(1);
    expect(ended.facts).toContainEqual({ type: 'endingReached', id: 'three-users' });
    expect(selectGame(ended.run, cat).ending?.paragraphs).toEqual(['Alive.']);
  });

  it('freezes time, needs and commands after the ending; repeating changes nothing', () => {
    const cat = testCatalog();
    const ended = act(createRun(1, 'r'), { type: 'choose', id: 'ship-original' }, cat);
    expect(steps(ended, 600, cat)).toBe(ended);
    for (const type of ['primaryAction', 'feedCat', 'petCat', 'startCatPlay'] as const) {
      expect(applyCommand(ended, { type }, 0, cat).result).toBe('unavailable');
    }
    const again = applyCommand(ended, { type: 'choose', id: 'ship-original' }, 0, cat);
    expect(again.result).toBe('unavailable');
    expect(again.run).toBe(ended);
  });

  it('resolves simultaneous automatic outcomes by explicit priority, not array order', () => {
    const cat = testCatalog({
      choices: [],
      endings: [
        { ...endingA, automatic: { priority: 1, when: () => true } },
        { ...endingB, automatic: { priority: 5, when: () => true } },
      ],
    });
    const run = stepRun(createRun(1, 'r'), 100, cat).run;
    expect(run.ending?.id).toBe('the-last-programmer');
  });

  it('captures the cat after the same step’s needs tick, so the variant is unambiguous', () => {
    const base = createRun(1, 'r');
    const dying: RunState = {
      ...base,
      cat: { ...base.cat, fullness: 0, health: 0.5, needsElapsedMs: 4900 },
    };
    const cat = testCatalog({
      choices: [],
      endings: [{ ...endingA, automatic: { priority: 1, when: () => true } }],
    });
    const run = stepRun(dying, 100, cat).run;
    expect(run.cat.alive).toBe(false);
    expect(run.ending?.catAlive).toBe(false);
    expect(selectGame(run, cat).ending?.paragraphs).toEqual(['Gone.']);
  });

  it('rejects a choice that is not currently available', () => {
    const cat = testCatalog({ choices: [{ ...finish, available: () => false }] });
    expect(
      applyCommand(createRun(1, 'r'), { type: 'choose', id: 'ship-original' }, 0, cat).result,
    ).toBe('unavailable');
  });
});
