// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createUiGame, nullRenderer } from '../../tests/helpers/uiGame';
import type { GameSnapshot } from '../app/createGame';
import App from '../app/App.svelte';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '');
});

function setup() {
  const ui = createUiGame();
  let latest: GameSnapshot | undefined;
  ui.game.api.subscribe((s) => {
    latest = s;
  });
  render(App, {
    props: {
      api: ui.game.api,
      illustrationUrl: () => null,
      createRenderer: nullRenderer,
      clock: { activeNow: () => ui.game.activeNow(), frames: () => () => {} },
    },
  });
  const write = async (count: number) => {
    for (let i = 0; i < count; i += 1) {
      await fireEvent.click(screen.getByTestId('primary-action'));
      ui.tick(100);
    }
  };
  return { ...ui, latest: () => latest, write };
}

function allDomText(): string {
  const labels = [...document.querySelectorAll('[aria-label],[title],[alt]')].map((el) =>
    ['aria-label', 'title', 'alt'].map((a) => el.getAttribute(a) ?? '').join(' '),
  );
  return `${document.body.innerHTML} ${labels.join(' ')}`;
}

describe('Game controls', () => {
  it('sends exactly one command per primary press', async () => {
    const t = setup();
    await t.write(1);
    expect(t.latest()?.run.economy.output).toBe(1);
  });

  it('shows a disabled price that cannot spend output', async () => {
    const t = setup();
    await t.write(6);
    const card = screen.getByRole<HTMLButtonElement>('button', { name: /Autocomplete/ });
    expect(card.disabled).toBe(true);
    await fireEvent.click(card);
    expect(t.latest()?.run.economy.output).toBe(6);
    expect(t.latest()?.run.upgradeLevels).toEqual({});
  });

  it('removes a bought card, never shows more than three, and leaks no future title', async () => {
    const t = setup();
    await t.write(10);
    expect(
      within(screen.getByRole('list', { name: 'Upgrades' })).getAllByRole('listitem').length,
    ).toBeLessThanOrEqual(3);
    await fireEvent.click(screen.getByRole('button', { name: /Autocomplete/ }));
    expect(screen.queryByRole('list', { name: 'Upgrades' })).toBeNull();
    const text = allDomText();
    expect(text).not.toMatch(/Generated snippets|AI-native IDE|generated-snippets/);
  });

  it('keeps CAT and HISTORY usable during an announcement', async () => {
    const t = setup();
    await t.write(10);
    await fireEvent.click(screen.getByRole('button', { name: /Autocomplete/ }));
    expect(screen.getByTestId('announcement')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'HISTORY' }));
    expect(screen.getByRole('heading', { name: 'HISTORY' })).toBeTruthy();
    expect(t.latest()?.run.pendingUnlockIds).toEqual(['autocomplete']);
  });

  it('defers an announcement made while Cat is open until Game returns', async () => {
    const t = setup();
    await t.write(10);
    await fireEvent.click(screen.getByRole('button', { name: /^Cat\./ }));
    t.game.api.dispatch({ type: 'buyUpgrade', id: 'autocomplete' });
    t.tick(5000);
    expect(t.latest()?.run.pendingUnlockIds).toEqual(['autocomplete']);
    expect(screen.queryByRole('heading', { name: 'Autocomplete' })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: '← GAME' }));
    expect(screen.getByRole('heading', { name: 'Autocomplete' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }));
    expect(t.latest()?.run.pendingUnlockIds).toEqual([]);
    expect(screen.queryByTestId('announcement')).toBeNull();
  });
});
