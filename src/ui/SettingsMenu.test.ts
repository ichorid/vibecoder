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

describe('settings credits', () => {
  it('credit the author and license, and link to the source', async () => {
    const ui = createUiGame();
    render(App, {
      props: {
        api: ui.game.api,
        illustrationUrl: () => null,
        createRenderer: nullRenderer,
        clock: { activeNow: () => ui.game.activeNow(), frames: () => () => {} },
      },
    });
    await fireEvent.click(screen.getByTestId('settings-button'));
    const credits = screen.getByTestId('credits');
    expect(credits.textContent).toContain('© GPLv3 Vadim Bulavintsev 2026.');
    const link = within(credits).getByRole('link', { name: 'github.com/ichorid/vibecoder' });
    expect(link.getAttribute('href')).toBe('https://github.com/ichorid/vibecoder');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});

describe('stop run', () => {
  it('abandons the current run after a confirmation and starts a fresh one', async () => {
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
    for (let i = 0; i < 3; i += 1) {
      await fireEvent.click(screen.getByTestId('primary-action'));
      ui.tick(400);
    }
    const before = latest?.run.id;
    expect(latest?.run.stats.manualActions).toBe(3);

    await fireEvent.click(screen.getByTestId('settings-button'));
    await fireEvent.click(screen.getByRole('button', { name: 'STOP RUN…' }));
    // Nothing happens until confirmed; CANCEL keeps the run.
    await fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }));
    expect(latest?.run.id).toBe(before);

    await fireEvent.click(screen.getByRole('button', { name: 'STOP RUN…' }));
    await fireEvent.click(screen.getByRole('button', { name: 'STOP AND START OVER' }));
    expect(latest?.run.id).not.toBe(before);
    expect(latest?.run.stats.manualActions).toBe(0);
    // Back in the game, menu closed.
    expect(screen.queryByTestId('credits')).toBeNull();
    expect(screen.getByTestId('primary-action')).toBeTruthy();
  });
});
