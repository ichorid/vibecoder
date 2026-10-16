import { catalog } from '../../src/content/catalog';
import { createGame } from '../../src/app/createGame';
import { createRun } from '../../src/game/createRun';
import { createProfile, createSaveAdapter } from '../../src/persistence/save';
import { createFakeClock, createFakeScheduler } from './fakeClock';
import { createMemoryStorage } from './memoryStorage';

/** A real composed game on a fake clock and in-memory storage, for component tests. */
export function createUiGame() {
  const clock = createFakeClock();
  const scheduler = createFakeScheduler();
  const storage = createMemoryStorage();
  const game = createGame({
    catalog,
    clock,
    scheduler,
    run: createRun(7, 'ui-run'),
    persistence: { adapter: createSaveAdapter(storage), profile: createProfile(), revision: 0 },
  });
  game.start();
  const tick = (ms: number) => {
    for (let t = 0; t < ms; t += 100) {
      clock.advance(100);
      scheduler.fire();
    }
  };
  return { game, storage, tick, clock };
}

/** Renderer stand-in for jsdom component tests (real Pixi is exercised in browser specs). */
export const nullRenderer = () =>
  Promise.resolve({ resize() {}, setActive() {}, update() {}, destroy() {} });
