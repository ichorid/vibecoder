import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { steps } from '../../tests/helpers/run';
import { applyCommand } from './commands';
import { createRun } from './createRun';
import type { RunState } from './types';

function hungryRun(fullness = 40): RunState {
  const run = createRun(11, 'r');
  return { ...run, cat: { ...run.cat, fullness } };
}

const feed = (run: RunState, at = run.activeMs) =>
  applyCommand(run, { type: 'feedCat' }, at, catalog);
const pet = (run: RunState, at = run.activeMs) =>
  applyCommand(run, { type: 'petCat' }, at, catalog);

describe('FEED', () => {
  it('adds a seeded integer 18–32 and advances the cat stream', () => {
    const run = hungryRun();
    const fed = feed(run);
    expect(fed.result).toBe('applied');
    const gain = fed.run.cat.fullness - 40;
    expect(Number.isInteger(gain)).toBe(true);
    expect(gain).toBeGreaterThanOrEqual(18);
    expect(gain).toBeLessThanOrEqual(32);
    expect(fed.run.rng.cat).not.toBe(run.rng.cat);
    expect(fed.run.rng.economy).toBe(run.rng.economy);
  });

  it('never exceeds fullness 100', () => {
    expect(feed(hungryRun(95)).run.cat.fullness).toBe(100);
  });

  it('rejects a repeat within the eating lock without consuming randomness', () => {
    const first = feed(hungryRun(20)).run;
    const early = feed(first, first.activeMs + 999);
    expect(early.result).toBe('cooldown');
    expect(early.run).toBe(first);
    const later = steps(first, 10, catalog);
    expect(feed(later, later.activeMs).result).toBe('applied');
  });

  it('gives different gains across seeds but the same gain for the same seed', () => {
    const gains = new Set<number>();
    for (let seed = 1; seed <= 20; seed += 1) {
      const run = createRun(seed, 'r');
      gains.add(feed({ ...run, cat: { ...run.cat, fullness: 0 } }).run.cat.fullness);
    }
    expect(gains.size).toBeGreaterThan(3);
    expect(feed(hungryRun()).run.cat.fullness).toBe(feed(hungryRun()).run.cat.fullness);
  });
});

describe('PET', () => {
  it('is allowed right away and adds 3 mood', () => {
    const petted = pet(createRun(1, 'r'));
    expect(petted.result).toBe('applied');
    expect(petted.run.cat.mood).toBe(88);
  });

  it('gives no reward again before the cooldown has passed', () => {
    const cooldown = catalog.balance.cat.petCooldownMs;
    const run = pet(createRun(1, 'r')).run;
    const again = pet(run, cooldown - 1);
    expect(again.result).toBe('cooldown');
    expect(again.run.cat.mood).toBe(88);
    expect(pet(run, cooldown).run.cat.mood).toBe(91);
  });

  it('caps mood at 100', () => {
    const run = createRun(1, 'r');
    expect(pet({ ...run, cat: { ...run.cat, mood: 99 } }).run.cat.mood).toBe(100);
  });
});

describe('care and liveness', () => {
  it('rejects care for a dead cat without consuming randomness', () => {
    const run = createRun(1, 'r');
    const dead = { ...run, cat: { ...run.cat, alive: false, health: 0, diedAtActiveMs: 0 } };
    expect(feed(dead).result).toBe('unavailable');
    expect(feed(dead).run).toBe(dead);
    expect(pet(dead).result).toBe('unavailable');
  });
});
