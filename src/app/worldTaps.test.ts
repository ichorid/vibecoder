// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createUiGame } from '../../tests/helpers/uiGame';
import type { RendererPort, WorldTap } from '../world/host';
import type { GameSnapshot } from './createGame';
import App from './App.svelte';

afterEach(cleanup);

/** A renderer stand-in whose world objects can be "tapped" by the test. */
function tappableRenderer() {
  const bus: { emit: ((tap: WorldTap) => void) | null } = { emit: null };
  const factory = () =>
    Promise.resolve<RendererPort>({
      resize() {},
      setActive() {},
      update() {},
      destroy() {},
      onTap(listener) {
        bus.emit = listener;
        return () => (bus.emit = null);
      },
    });
  const tap = async (target: WorldTap['target']) => {
    bus.emit?.({ target, x: 50, y: 50 });
    await tick();
  };
  return { factory, tap, ready: () => bus.emit !== null };
}

async function setup() {
  const ui = createUiGame();
  let latest: GameSnapshot | undefined;
  ui.game.api.subscribe((s) => (latest = s));
  const renderer = tappableRenderer();
  render(App, {
    props: {
      api: ui.game.api,
      illustrationUrl: () => null,
      createRenderer: renderer.factory,
      clock: { activeNow: () => ui.game.activeNow(), frames: () => () => {} },
    },
  });
  for (let i = 0; i < 10 && !renderer.ready(); i += 1) await tick();
  const run = () => {
    if (!latest) throw new Error('no snapshot');
    return latest.run;
  };
  const floats = () =>
    [...document.querySelectorAll('[data-testid="floating-gain"]')].map((f) =>
      f.textContent?.trim(),
    );
  return { ...ui, run, tap: renderer.tap, floats };
}

describe('tapping world objects', () => {
  it('the monitor works like a primary press and floats the gain', async () => {
    const t = await setup();
    await t.tap('monitor');
    t.tick(100);
    expect(t.run().stats.lifetimeOutput).toBe(1);
    expect(t.floats()).toContain('+1');
  });

  it('an empty spot of the world works like a primary press too', async () => {
    const t = await setup();
    await t.tap('scene');
    await t.tap('scene');
    t.tick(100);
    expect(t.run().stats.lifetimeOutput).toBe(2);
    expect(t.floats()).toEqual(['+1', '+1']);
  });

  it('the poster, the bookshelf and the window only joke (nothing changes)', async () => {
    const t = await setup();
    await t.tap('poster');
    await t.tap('poster');
    await t.tap('shelf');
    await t.tap('window');
    t.tick(100);
    expect(t.run().stats.lifetimeOutput).toBe(0);
    expect(t.floats()).toEqual([
      '+1 motivation (does nothing)',
      '+1 inspiration (expired)',
      'no time for that',
      'maybe other time',
    ]);
  });

  it('the plant can be watered (and drowned)', async () => {
    const t = await setup();
    await t.tap('plant');
    expect(t.floats().at(-1)).toMatch(/^glug/);
    await t.tap('plant');
    expect(t.run().plant.alive).toBe(false);
    expect(t.floats().at(-1)).toBe('oops');
  });

  it('the bowl feeds the cat and says so', async () => {
    const t = await setup();
    const before = t.run().cat.fullness;
    await t.tap('bowl');
    expect(t.run().cat.fullness).toBeGreaterThan(before);
    expect(t.floats().at(-1)).toMatch(/fed|not hungry|too much|spherical/);
  });

  it('the cat purrs (PET) and only meows during the cooldown', async () => {
    const t = await setup();
    const mood = t.run().cat.mood;
    await t.tap('cat');
    expect(t.run().cat.mood).toBe(mood + 3);
    expect(t.floats().at(-1)).toBe('purr');
    await t.tap('cat');
    expect(t.run().cat.mood).toBe(mood + 3);
    expect(t.floats().at(-1)).toBe('meow');
  });
});
