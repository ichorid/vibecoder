import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { applyCommand } from './commands';
import { createRun } from './createRun';
import { plantLook } from './plant';
import { stepRun } from './simulation';
import type { RunState } from './types';

const b = catalog.balance.plant;
const water = (run: RunState) => applyCommand(run, { type: 'waterPlant' }, run.activeMs, catalog);
function minutes(start: RunState, m: number): RunState {
  let run = start;
  for (let i = 0; i < m * 600; i += 1) run = stepRun(run, 100, catalog).run;
  return run;
}

describe('the corner plant', () => {
  it('starts alive and watered; water drains with active time', () => {
    const run = createRun(1, 'plant');
    expect(plantLook(run, catalog)).toBe('ok');
    expect(minutes(run, 1).plant.water).toBeCloseTo(b.start - b.drainPerMinute, 6);
  });

  it('watered too often, it drowns', () => {
    const once = water(createRun(1, 'plant')).run;
    expect(once.plant.alive).toBe(true);
    expect(plantLook(once, catalog)).toBe('soggy');
    const twice = water(once).run;
    expect(twice.plant).toMatchObject({ alive: false, cause: 'drowned' });
    expect(twice.log.at(-1)?.text).toMatch(/drowned/);
    expect(water(twice).result).toBe('unavailable');
  });

  it('watered too rarely, it warns once and then dries out', () => {
    const thirsty = minutes(createRun(1, 'plant'), 5);
    expect(plantLook(thirsty, catalog)).toBe('thirsty');
    expect(thirsty.log.filter((l) => l.text.includes('thirsty'))).toHaveLength(1);
    const dry = minutes(thirsty, 3);
    expect(dry.plant).toMatchObject({ alive: false, cause: 'dried' });
    expect(plantLook(dry, catalog)).toBe('dead');
  });

  it('watered every few minutes, it lives', () => {
    let run = createRun(1, 'plant');
    for (let i = 0; i < 6; i += 1) run = water(minutes(run, 4.5)).run;
    expect(run.plant.alive).toBe(true);
  });
});
