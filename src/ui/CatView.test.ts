// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createUiGame } from '../../tests/helpers/uiGame';
import type { GameSnapshot } from '../app/createGame';
import CatView from './CatView.svelte';

afterEach(cleanup);

function setup() {
  const ui = createUiGame();
  let latest: GameSnapshot | undefined;
  ui.game.api.subscribe((s) => (latest = s));
  const snapshot = () => {
    if (!latest) throw new Error('no snapshot');
    return latest;
  };
  const view = render(CatView, {
    props: {
      cat: snapshot().cat,
      dispatch: ui.game.api.dispatch,
      clock: { activeNow: () => ui.game.activeNow(), frames: () => () => {} },
      onReturn: () => {},
    },
  });
  return { ...ui, snapshot, view };
}

describe('Cat view portrait', () => {
  it('tapping the cat says meow, plays a reaction and counts as PET', async () => {
    const t = setup();
    const mood = t.snapshot().run.cat.mood;
    await fireEvent.click(screen.getByRole('button', { name: 'Tap the cat' }));
    expect(t.snapshot().run.cat.mood).toBe(mood + 3);
    expect(document.querySelector('[data-testid="floating-gain"]')?.textContent).toBe('meow');
    expect(document.querySelector('[data-testid="cat-portrait"]')?.className).toMatch(/purr/);
  });

  it('a tap during the PET cooldown still meows but gives nothing', async () => {
    const t = setup();
    const portrait = screen.getByRole('button', { name: 'Tap the cat' });
    await fireEvent.click(portrait);
    const mood = t.snapshot().run.cat.mood;
    await fireEvent.click(portrait);
    expect(t.snapshot().run.cat.mood).toBe(mood);
    expect(document.querySelectorAll('[data-testid="floating-gain"]').length).toBe(2);
  });
});
