import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { steps } from '../../tests/helpers/run';
import { catConditions, noteMeaningfulAction, updateCat } from './cat';
import { createCat, createRun } from './createRun';
import type { CatState } from './types';

const balance = catalog.balance.cat;

function cat(overrides: Partial<CatState> = {}): CatState {
  return { ...createCat(), ...overrides };
}

function advance(state: CatState, ms: number): CatState {
  let next = state;
  for (let t = 0; t < ms; t += 100) next = updateCat(next, 100, balance).cat;
  return next;
}

describe('cat needs tick', () => {
  it('changes nothing before 5000 active ms and ticks once at 5000', () => {
    const start = cat();
    const before = advance(start, 4900);
    expect(before.fullness).toBe(75);
    expect(before.mood).toBe(85);
    const after = advance(start, 5000);
    expect(after.fullness).toBeCloseTo(75 - 0.65, 9);
    expect(after.mood).toBeCloseTo(85 - 0.45, 9);
    expect(advance(start, 9900).fullness).toBeCloseTo(75 - 0.65, 9);
  });

  it('keeps values inside 0–100', () => {
    const empty = advance(cat({ fullness: 0.1, mood: 0.1 }), 5000);
    expect(empty.fullness).toBe(0);
    expect(empty.mood).toBe(0);
  });

  it.each([
    [1, 0.01],
    [10, 0.1],
    [1000, 0.1],
  ])('accelerates decay by a capped modifier for %i meaningful actions', (count, modifier) => {
    let state = cat();
    for (let i = 0; i < count; i += 1) state = noteMeaningfulAction(state);
    const ticked = advance(state, 5000);
    expect(75 - ticked.fullness).toBeCloseTo(0.65 * (1 + modifier), 9);
    expect(ticked.pendingActions).toBe(0);
    const next = advance(ticked, 5000);
    expect(ticked.fullness - next.fullness).toBeCloseTo(0.65, 9);
  });

  it('lets hungry, lonely and overfed hold at the same time', () => {
    const flags = catConditions(cat({ fullness: 30, mood: 60, overfeeding: 50 }), balance);
    expect(flags).toMatchObject({ hungry: true, lonely: true, overfed: true, sick: false });
  });

  it.each([
    ['fullness', 35, 'hungry', false],
    ['fullness', 34.99, 'hungry', true],
    ['mood', 70, 'lonely', false],
    ['mood', 69.99, 'lonely', true],
    ['mood', 40, 'attentionSeeking', false],
    ['mood', 39.99, 'attentionSeeking', true],
  ] as const)('threshold %s=%f → %s is %s', (field, value, flag, expected) => {
    expect(catConditions(cat({ [field]: value }), balance)[flag]).toBe(expected);
  });
});

describe('cat in the simulation', () => {
  it('is updated by simulation steps', () => {
    const run = steps(createRun(1, 'r'), 50, catalog);
    expect(run.cat.fullness).toBeCloseTo(75 - 0.65, 9);
  });

  it('counts primary and upgrade actions, but not navigation-free care, toward acceleration', () => {
    const run = createRun(1, 'r');
    const primary = steps({ ...run, cat: noteMeaningfulAction(run.cat) }, 50, catalog);
    expect(75 - primary.cat.fullness).toBeCloseTo(0.65 * 1.01, 9);
  });
});

describe('meaningful actions', () => {
  it('counts primary and purchase commands, not care or acknowledgement', async () => {
    const { act, clickAndSettle } = await import('../../tests/helpers/run');
    let run = clickAndSettle(createRun(1, 'r'), 10, catalog);
    expect(run.cat.pendingActions).toBe(10);
    run = act(run, { type: 'buyUpgrade', id: 'autocomplete' }, catalog);
    expect(run.cat.pendingActions).toBe(11);
    run = act(run, { type: 'acknowledgeUnlock', id: 'autocomplete' }, catalog);
    run = act(run, { type: 'petCat' }, catalog);
    run = act(run, { type: 'feedCat' }, catalog);
    expect(run.cat.pendingActions).toBe(11);
  });
});

describe('starvation, recovery and overfeeding', () => {
  const perTick = (perMinute: number) => perMinute / 12;

  it('uses different starvation rates below 20 and at or below 5', () => {
    const mild = advance(cat({ fullness: 15, health: 80 }), 5000);
    expect(80 - mild.health).toBeCloseTo(perTick(8), 9);
    const severe = advance(cat({ fullness: 4, health: 80 }), 5000);
    expect(80 - severe.health).toBeCloseTo(perTick(14), 9);
  });

  it('stops starvation damage once fed but does not heal instantly', async () => {
    const { applyCommand } = await import('./commands');
    const run = createRun(3, 'r');
    const starving = { ...run, cat: { ...run.cat, fullness: 2, health: 40 } };
    const fed = applyCommand(starving, { type: 'feedCat' }, 0, catalog).run;
    expect(fed.cat.health).toBe(40);
    expect(fed.cat.fullness).toBeGreaterThan(19);
    const later = steps(fed, 50, catalog);
    expect(later.cat.health).toBeGreaterThanOrEqual(40);
  });

  it('recovers health gradually above fullness 35 when not sick', () => {
    const recovering = advance(cat({ fullness: 60, health: 50 }), 60_000);
    expect(recovering.health).toBeCloseTo(54, 6);
    expect(advance(cat({ fullness: 36, health: 99.9 }), 5000).health).toBe(100);
    expect(advance(cat({ fullness: 35.5, health: 99.9 }), 5000).health).toBe(99.9);
  });

  it('does not recover or starve between 20 and 35 fullness', () => {
    expect(advance(cat({ fullness: 30, health: 50 }), 5000).health).toBe(50);
  });

  it('decays overfeeding pressure over time without excessive meals', () => {
    expect(advance(cat({ overfeeding: 30 }), 60_000).overfeeding).toBeCloseTo(24, 6);
    expect(advance(cat({ overfeeding: 0.2 }), 5000).overfeeding).toBe(0);
  });

  it('makes one excessive meal not sick, repeated ones overfed then sick', async () => {
    const { applyCommand } = await import('./commands');
    let run = createRun(9, 'r');
    run = { ...run, cat: { ...run.cat, fullness: 90 } };
    const meals: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      run = applyCommand(run, { type: 'feedCat' }, run.activeMs, catalog).run;
      meals.push(run.cat.overfeeding);
      run = steps(run, 10, catalog);
    }
    const flags = (o: number) => catConditions(cat({ overfeeding: o }), balance);
    expect(flags(meals[0] ?? 0)).toMatchObject({ overfed: false, sick: false });
    expect(flags(meals[1] ?? 0).overfed).toBe(true);
    expect(flags(meals[3] ?? 0).sick).toBe(true);
  });

  it('makes sickness cost mood faster and health only down to the floor of 10', () => {
    const sick = advance(cat({ overfeeding: 200, fullness: 30, mood: 50, health: 10.1 }), 60_000);
    expect(50 - sick.mood).toBeCloseTo(0.45 * 12 + 1, 6);
    expect(sick.health).toBe(10);
    const healthy = advance(cat({ fullness: 30, mood: 50 }), 60_000);
    expect(50 - healthy.mood).toBeCloseTo(0.45 * 12, 6);
  });

  it('never kills a well-fed cat with zero mood', () => {
    const sad = advance(cat({ mood: 0, fullness: 100 }), 10 * 60_000);
    expect(sad.alive).toBe(true);
    expect(sad.health).toBe(100);
  });

  it('does not let the sickness floor protect a starving cat', () => {
    const doomed = advance(cat({ overfeeding: 200, fullness: 0, health: 12 }), 60_000);
    expect(doomed.alive).toBe(false);
    expect(doomed.health).toBe(0);
  });

  it('kills a totally neglected cat in under 30 active minutes', () => {
    let run = createRun(1, 'neglect');
    let minutes = 0;
    while (run.cat.alive && minutes < 30) {
      run = steps(run, 600, catalog);
      minutes += 1;
    }
    expect(run.cat.alive).toBe(false);
    expect(minutes).toBeLessThan(30);
    expect(minutes).toBeGreaterThan(8);
  });
});
