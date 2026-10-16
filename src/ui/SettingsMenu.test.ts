// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createUiGame, nullRenderer } from '../../tests/helpers/uiGame';
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
