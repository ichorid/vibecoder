// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createUiGame, nullRenderer } from '../../tests/helpers/uiGame';
import type { GameSnapshot } from './createGame';
import App from './App.svelte';

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
  return { ...ui, latest: () => latest };
}

async function clickTimes(name: string | RegExp, count: number, tick: (ms: number) => void) {
  for (let i = 0; i < count; i += 1) {
    await fireEvent.click(screen.getByRole('button', { name }));
    tick(100);
  }
}

describe('App navigation', () => {
  it('starts on Game with exactly one primary action', () => {
    setup();
    expect(screen.getByRole('button', { name: 'WRITE CODE' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'HISTORY' })).toBeNull();
  });

  it('opens History with only current entries and returns to Game', async () => {
    const t = setup();
    await clickTimes('WRITE CODE', 10, t.tick);
    await fireEvent.click(screen.getByRole('button', { name: /Autocomplete/ }));
    await fireEvent.click(screen.getByRole('button', { name: 'HISTORY' }));
    expect(screen.getByRole('heading', { name: 'HISTORY' })).toBeTruthy();
    const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(items.some((text) => text.includes('Autocomplete'))).toBe(true);
    expect(document.body.textContent).not.toMatch(/Generated|IDE/);
    await fireEvent.click(screen.getByRole('button', { name: '← GAME' }));
    expect(screen.queryByRole('heading', { name: 'HISTORY' })).toBeNull();
    expect(screen.getByRole('button', { name: 'WRITE CODE' })).toBeTruthy();
  });

  it('opens Cat from the header and returns with browser Back', async () => {
    setup();
    await fireEvent.click(screen.getByRole('button', { name: /^Cat\./ }));
    expect(screen.getByRole('heading', { name: 'CAT' })).toBeTruthy();
    window.history.back();
    await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    await Promise.resolve();
    expect(screen.queryByRole('heading', { name: 'CAT' })).toBeNull();
  });

  it('keeps the same run and economy running while another view is open', async () => {
    const t = setup();
    const runId = t.latest()?.run.id;
    await fireEvent.click(screen.getByRole('button', { name: 'HISTORY' }));
    t.tick(1000);
    await fireEvent.click(screen.getByRole('button', { name: /^Cat\./ }));
    t.tick(1000);
    expect(t.latest()?.run.id).toBe(runId);
    expect(t.latest()?.run.activeMs).toBe(2000);
  });

  it('changes theme from Settings independently of progression and saves it in the profile', async () => {
    const t = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(t.latest()?.profile.theme).toBe('dark');
    expect(t.latest()?.run.unlockedTechnologyIds).toEqual([]);
    const saved = JSON.parse(t.storage.getItem('vibe-coder.save') ?? '{}') as {
      profile?: { theme?: string };
    };
    expect(saved.profile?.theme).toBe('dark');
  });
});
