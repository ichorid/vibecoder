// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createUiGame, nullRenderer } from '../../tests/helpers/uiGame';
import App from '../app/App.svelte';
import { version } from '../../package.json';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '');
});

describe('the header', () => {
  it('shows the game version from package.json next to the title', () => {
    const ui = createUiGame();
    render(App, {
      props: {
        api: ui.game.api,
        illustrationUrl: () => null,
        createRenderer: nullRenderer,
        clock: { activeNow: () => ui.game.activeNow(), frames: () => () => {} },
      },
    });
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(screen.getByTestId('app-version').textContent).toBe(`v${version}`);
  });
});
