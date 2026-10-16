// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUiGame, nullRenderer } from '../../tests/helpers/uiGame';
import App from '../app/App.svelte';

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal(
    'ImageData',
    class {
      readonly data: Uint8ClampedArray;
      constructor(w: number, h: number) {
        this.data = new Uint8ClampedArray(w * h * 4);
      }
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, '');
});

describe('Demo lab (dev server only)', () => {
  it('opens from Settings and shows the genome, its judged children and statistics', async () => {
    const ui = createUiGame();
    render(App, {
      props: {
        api: ui.game.api,
        illustrationUrl: () => null,
        createRenderer: nullRenderer,
        clock: { activeNow: () => ui.game.activeNow(), frames: () => () => {} },
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    await fireEvent.click(screen.getByTestId('demo-lab-open'));
    const lab = await screen.findByTestId('demo-lab');
    expect(screen.getByTestId('demo-lab-script').textContent).toMatch(/tube \w+1/);
    expect(screen.getByTestId('demo-lab-stats').textContent).toContain('score');
    expect(lab.querySelectorAll('.kid').length).toBeGreaterThan(0);
    await fireEvent.click(screen.getByRole('button', { name: 'MUTATE (judge)' }));
    await fireEvent.click(screen.getByRole('button', { name: 'BACK' }));
    await fireEvent.click(screen.getByRole('button', { name: 'CLOSE' }));
    expect(screen.queryByTestId('demo-lab')).toBeNull();
  });
});
