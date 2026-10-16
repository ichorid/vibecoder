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
    flushSync(); // components that mount mid-way start their own frames
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
  steps: [
    { seed: 11, pick: null },
    { seed: 22, pick: null },
  ],
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

  it("the demo screen offers the next demo's design; the picked preview is what gets coded", async () => {
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
    // the choice lives on the demo screen only
    expect(screen.queryByTestId('demo-designer')).toBeNull();
    await fireEvent.click(screen.getByTestId('demo-strip'));
    await fireEvent.click(screen.getByTestId('demo-depack')); // skip the intro
    runFrames(400);
    const first = screen.getByTestId('demo-screen');
    const designer = within(first).getByTestId('demo-designer');
    expect(designer.textContent).toContain('DESIGN DEMO #2');
    const variant = within(designer).getByTestId('demo-variant-1');
    const wanted = variant.getAttribute('data-fingerprint');
    expect(wanted).toMatch(/^[0-9a-f]{8}$/);
    expect(
      within(designer).getByTestId('demo-variant-0').getAttribute('data-fingerprint'),
    ).not.toBe(wanted);
    await fireEvent.click(variant);
    expect(variant.getAttribute('aria-checked')).toBe('true');
    await fireEvent.click(screen.getByRole('button', { name: 'CLOSE' }));
    await fireEvent.click(screen.getByTestId('demo-strip'));
    await fireEvent.click(screen.getByTestId('demo-depack'));
    runFrames(400);
    const second = screen.getByTestId('demo-screen');
    expect(second.getAttribute('data-phase')).toBe('play');
    expect(second.getAttribute('data-fingerprint')).toBe(wanted);
    await fireEvent.click(within(second).getByTestId('demo-mystery'));
    expect(within(second).getByTestId('demo-mystery').getAttribute('aria-checked')).toBe('true');
    // an older demo replayed from History offers no design
    await fireEvent.click(screen.getByRole('button', { name: 'CLOSE' }));
    await fireEvent.click(screen.getByRole('button', { name: 'HISTORY' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Watch demo 1' }));
    await fireEvent.click(screen.getByTestId('demo-depack'));
    runFrames(400);
    expect(screen.queryByTestId('demo-designer')).toBeNull();
  });
});
