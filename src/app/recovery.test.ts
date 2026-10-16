import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { decodeSave } from '../persistence/save';
import { createFakeClock, createFakeScheduler } from '../../tests/helpers/fakeClock';
import { createGame, type GameSnapshot } from './createGame';

function fromFixture(name: string) {
  const text = readFileSync(`tests/fixtures/saves/${name}.json`, 'utf8');
  const result = decodeSave(JSON.parse(text) as unknown, text);
  if (result.status !== 'loaded') throw new Error(result.status);
  const clock = createFakeClock();
  const scheduler = createFakeScheduler();
  const game = createGame({ catalog, clock, scheduler, run: result.save.run });
  let snapshot: GameSnapshot | null = null;
  game.api.subscribe((s) => (snapshot = s));
  const run = () => {
    if (!snapshot) throw new Error('no snapshot');
    return snapshot.run;
  };
  return { game, clock, scheduler, run };
}

describe('lifecycle recovery', () => {
  it('an ended run never revives: time passes, nothing is produced and the cat is untouched', () => {
    const t = fromFixture('v1-ended');
    const before = t.run();
    t.game.start();
    for (let i = 0; i < 100; i += 1) {
      t.clock.advance(100);
      t.scheduler.fire();
    }
    const after = t.run();
    expect(after.status).toBe('ended');
    expect(after.ending).toEqual(before.ending);
    expect(after.economy.output).toBe(before.economy.output);
    expect(after.cat.fullness).toBe(before.cat.fullness);
  });

  it('a long main-thread stall gives no catch-up and cannot starve the cat', () => {
    const t = fromFixture('v1-midgame');
    t.game.start();
    t.clock.advance(100);
    t.scheduler.fire();
    const before = t.run();
    t.clock.advance(45 * 60_000); // one 45-minute gap: the tab was stalled, not played
    t.scheduler.fire();
    const after = t.run();
    expect(after.activeMs - before.activeMs).toBeLessThanOrEqual(100);
    expect(after.cat.alive).toBe(true);
  });

  it('repeated suspends for different reasons resume once, without double counting', () => {
    const t = fromFixture('v1-midgame');
    t.game.start();
    const start = t.run().activeMs;
    t.game.suspend('blurred');
    t.game.suspend('hidden');
    t.game.suspend('frozen');
    t.game.suspend('hidden');
    t.clock.advance(60_000);
    t.game.resume('frozen');
    t.game.resume('hidden');
    expect(t.game.isActive()).toBe(false);
    t.game.resume('blurred');
    expect(t.game.isActive()).toBe(true);
    t.clock.advance(300);
    t.scheduler.fire();
    expect(t.run().activeMs - start).toBe(300);
  });
});
