// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { progressedRun } from '../../tests/browser/fixtures';
import { createUiGame, nullRenderer } from '../../tests/helpers/uiGame';
import App from '../app/App.svelte';
import type { DemoViewModel } from '../game/selectors';
import DemoScreen from './DemoScreen.svelte';

/** Animation frames run by hand. */
let frames: FrameRequestCallback[] = [];
const runFrames = (count: number) => {
  for (let i = 0; i < count && frames.length > 0; i++) {
    const due = frames;
    frames = [];
    for (const cb of due) cb(performance.now());
  }
  flushSync();
};
beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  // jsdom has no 2D canvas; the demo must still show its texts
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, '');
});

const demo: DemoViewModel = {
  number: 2,
  seeds: [11, 22],
  title: 'Organic Tentacles',
  group: 'Vibe Coderz',
  greetings: ['the reviewer agent', 'the rubber duck', 'the GPU fans'],
  scroller: ['Ship it? No. Watch it.'],
  activeMs: 0,
};

describe('the demo popup', () => {
  it('depacks the lineage, then plays: title card, group, scroller with greetings', () => {
    render(DemoScreen, { props: { demo, reducedMotion: true, onClose: () => {} } });
    const screenEl = screen.getByTestId('demo-screen');
    expect(screenEl.getAttribute('data-phase')).toBe('depack');
    expect(screen.getByTestId('demo-depack').textContent).toContain('2 GENERATIONS');
    runFrames(50);
    expect(screenEl.getAttribute('data-phase')).toBe('play');
    expect(screen.getByTestId('demo-title').textContent).toBe('Organic Tentacles');
    expect(screenEl.textContent).toContain('by Vibe Coderz');
    expect(screen.getByTestId('demo-scroller').textContent).toContain(
      'Greetings to the reviewer agent, the rubber duck, the GPU fans.',
    );
  });

  it('CLOSE and Escape close it', async () => {
    const onClose = vi.fn();
    render(DemoScreen, { props: { demo, reducedMotion: false, onClose } });
    await fireEvent.click(screen.getByRole('button', { name: 'CLOSE' }));
    await fireEvent.keyDown(screen.getByTestId('demo-screen'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('is coded from its strip next to Ship It, and History can play it again', async () => {
    const run = progressedRun(4, false);
    const ui = createUiGame({ ...run, economy: { ...run.economy, output: 50_000 } });
    render(App, {
      props: {
        api: ui.game.api,
        illustrationUrl: () => null,
        createRenderer: nullRenderer,
        clock: { activeNow: () => ui.game.activeNow(), frames: () => () => {} },
      },
    });
    const strip = screen.getByTestId('demo-strip');
    expect(strip.textContent).toContain('DEMO #1');
    await fireEvent.click(strip);
    expect(screen.getByTestId('demo-screen')).toBeTruthy();
    expect(screen.getByTestId('demo-strip').textContent).toContain('DEMO #2');
    await fireEvent.click(screen.getByRole('button', { name: 'CLOSE' }));
    expect(screen.queryByTestId('demo-screen')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'HISTORY' }));
    const history = screen.getByRole('heading', { name: 'HISTORY' }).closest('section');
    if (!history) throw new Error('no history');
    await fireEvent.click(within(history).getByRole('button', { name: 'Watch demo 1' }));
    expect(screen.getByTestId('demo-screen')).toBeTruthy();
  });
});
