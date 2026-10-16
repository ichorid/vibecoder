// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createUiGame, nullRenderer } from '../../tests/helpers/uiGame';
import { progressedRun } from '../../tests/browser/fixtures';
import { AUTOCOMPLETE_PRICE } from '../../tests/helpers/run';
import type { GameSnapshot } from '../app/createGame';
import App from '../app/App.svelte';
import { formatAmount } from './format';

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
      // At the tap pace (about 3 per second): every press counts.
      ui.tick(400);
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

  it('floats the real gain of each accepted press up from the button', async () => {
    const t = setup();
    await t.write(3);
    const floats = [...document.querySelectorAll('[data-testid="floating-gain"]')];
    expect(floats.map((f) => f.textContent?.trim())).toEqual(['+1', '+1', '+1']);
    expect(floats.every((f) => f.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('keeps at most eight floating numbers at a time', async () => {
    const t = setup();
    await t.write(12);
    expect(document.querySelectorAll('[data-testid="floating-gain"]').length).toBeLessThanOrEqual(
      8,
    );
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

  it('shows the fixed price on Ship It and the demo strip, not what is left to earn', () => {
    const run = progressedRun(4, false);
    const ui = createUiGame({ ...run, economy: { ...run.economy, output: 1 } });
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
    const { release, demo } = latest?.game ?? {};
    if (!release || !demo) throw new Error('both strips must be on offer');
    expect(release.affordable || demo.affordable).toBe(false);
    const ship = screen.getByTestId('ship-strip').textContent ?? '';
    const code = screen.getByTestId('demo-strip').textContent ?? '';
    expect(ship).toContain(formatAmount(release.price));
    expect(code).toContain(formatAmount(demo.price));
    expect(`${ship} ${code}`).not.toContain('to go');
  });

  it('removes a bought card, never shows more than three, and leaks no future title', async () => {
    const t = setup();
    await t.write(AUTOCOMPLETE_PRICE);
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
    await t.write(AUTOCOMPLETE_PRICE);
    await fireEvent.click(screen.getByRole('button', { name: /Autocomplete/ }));
    expect(screen.getByTestId('announcement')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'HISTORY' }));
    expect(screen.getByRole('heading', { name: 'HISTORY' })).toBeTruthy();
    expect(t.latest()?.run.pendingUnlockIds).toEqual(['autocomplete']);
  });

  it('defers an announcement made while Cat is open until Game returns', async () => {
    const t = setup();
    await t.write(AUTOCOMPLETE_PRICE);
    await fireEvent.click(screen.getByRole('button', { name: /^Cat\./ }));
    t.game.api.dispatch({ type: 'buyUpgrade', id: 'autocomplete' });
    t.tick(5000);
    expect(t.latest()?.run.pendingUnlockIds).toEqual(['autocomplete']);
    expect(screen.queryByRole('heading', { name: 'Autocomplete' })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: '← BACK TO CODE' }));
    expect(screen.getByRole('heading', { name: 'Autocomplete' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }));
    expect(t.latest()?.run.pendingUnlockIds).toEqual([]);
    expect(screen.queryByTestId('announcement')).toBeNull();
  });
});
