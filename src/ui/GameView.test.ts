// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createUiGame, nullRenderer } from '../../tests/helpers/uiGame';
import { progressedRun } from '../../tests/browser/fixtures';
import { AUTOCOMPLETE_PRICE } from '../../tests/helpers/run';
import type { GameSnapshot } from '../app/createGame';
import App from '../app/App.svelte';
import { formatAmount } from './format';
import { buildRow, deckItem, needDeckItem } from '../../tests/helpers/deck';

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
      // About 3 presses per second.
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

describe('the terminal', () => {
  it('keeps the whole remembered log in a scrollable, keyboard-reachable region', () => {
    const base = progressedRun(2);
    const log = Array.from({ length: 12 }, (_, i) => ({ text: `line ${i}`, activeMs: i * 1000 }));
    render(App, {
      props: {
        api: createUiGame({ ...base, log }).game.api,
        illustrationUrl: () => null,
        createRenderer: nullRenderer,
        clock: { activeNow: () => 0, frames: () => () => {} },
      },
    });
    const terminal = screen.getByRole('region', { name: 'Recent events' });
    expect(terminal.getAttribute('tabindex')).toBe('0');
    const lines = within(terminal).getAllByRole('listitem');
    expect(lines.map((l) => l.textContent?.trim().replace(/^\[[^\]]*\]\s*/, ''))).toEqual(
      log.map((l) => l.text),
    );
  });
});

describe('Game controls', () => {
  it('sends exactly one command per primary press', async () => {
    const t = setup();
    await t.write(1);
    expect(t.latest()?.run.stats.lifetimeOutput).toBe(1);
  });

  it('floats the real gain of each accepted press up from the button', async () => {
    const t = setup();
    await t.write(3);
    const floats = [...document.querySelectorAll('[data-testid="floating-gain"]')];
    expect(floats.map((f) => f.textContent?.trim())).toEqual(['+1', '+1', '+1']);
    expect(floats.every((f) => f.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('mashing without pause: every press counts and floats its gain', async () => {
    const t = setup();
    for (let i = 0; i < 7; i += 1) await fireEvent.click(screen.getByTestId('primary-action'));
    expect(t.latest()?.run.stats.manualActions).toBe(7);
    const floats = [...document.querySelectorAll('[data-testid="floating-gain"]')];
    expect(floats.map((f) => f.textContent?.trim())).toEqual(Array<string>(7).fill('+1'));
    expect(screen.queryByTestId('strain')).toBeNull();
  });

  it('keeps at most eight floating numbers at a time', async () => {
    const t = setup();
    await t.write(12);
    expect(document.querySelectorAll('[data-testid="floating-gain"]').length).toBeLessThanOrEqual(
      8,
    );
  });

  it('a tap on a lane card builds it: the highlight moves to it, every card stays in place', async () => {
    const t = setup();
    await t.write(6);
    const card = needDeckItem('autocomplete');
    expect((card as HTMLButtonElement).disabled).toBe(false);
    expect(buildRow().getAttribute('data-key')).toBe('release');
    const order = () =>
      [...document.querySelectorAll<HTMLElement>('[data-lane-key]')].map(
        (el) => el.dataset.laneKey,
      );
    const before = order();
    await fireEvent.click(card);
    expect(t.latest()?.run.slots[0]).toMatchObject({ target: 'autocomplete', by: 'player' });
    expect(buildRow().getAttribute('data-key')).toBe('autocomplete');
    expect(within(buildRow()).getByTestId('project-badge').textContent).toBe('BUILDING');
    expect(order()).toEqual(before);
    expect(needDeckItem('autocomplete').dataset.building).toBe('0');
    // The release waits where it was, not building, and is not news.
    const release = needDeckItem('release');
    expect(release.dataset.building).toBeUndefined();
    expect(release.textContent).not.toContain('NEW');
    await t.write(3);
    expect(t.latest()?.run.projects.autocomplete?.code).toBe(3);
    expect(t.latest()?.run.upgradeLevels).toEqual({});
  });

  it('shows the fixed price on the project and the demo, not what is left to earn', () => {
    const run = progressedRun(4, false);
    const ui = createUiGame(run);
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
    if (!release || !demo) throw new Error('both must be on offer');
    expect(release.affordable || demo.affordable).toBe(false);
    const ship = needDeckItem('release').textContent ?? '';
    const code = needDeckItem('demo').textContent ?? '';
    expect(ship).toContain(formatAmount(release.price));
    expect(code).toContain(formatAmount(demo.price));
    expect(`${ship} ${code}`).not.toContain('to go');
  });

  it('removes a built card, never shows more than three new cards, and leaks no future title', async () => {
    const t = setup();
    await t.write(5);
    const cards = [...document.querySelectorAll<HTMLElement>('[data-lane-key]')].filter((el) =>
      ['upgrade', 'choice'].includes(el.dataset.kind ?? ''),
    );
    expect(cards.length).toBeLessThanOrEqual(3);
    await fireEvent.click(screen.getByRole('button', { name: /Autocomplete/ }));
    await t.write(AUTOCOMPLETE_PRICE);
    expect(t.latest()?.run.upgradeLevels.autocomplete).toBe(1);
    expect(deckItem('autocomplete')).toBeNull();
    const text = allDomText();
    expect(text).not.toMatch(/Generated snippets|AI-native IDE|generated-snippets/);
  });

  it('keeps CAT and HISTORY usable during an announcement', async () => {
    const t = setup();
    await t.write(5);
    await fireEvent.click(screen.getByRole('button', { name: /Autocomplete/ }));
    await t.write(AUTOCOMPLETE_PRICE);
    expect(screen.getByTestId('announcement')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'HISTORY' }));
    expect(screen.getByRole('heading', { name: 'HISTORY' })).toBeTruthy();
    expect(t.latest()?.run.pendingUnlockIds).toEqual(['autocomplete']);
  });

  it('defers an announcement made while Cat is open until Game returns', async () => {
    const t = setup();
    await t.write(5);
    await fireEvent.click(screen.getByRole('button', { name: /Autocomplete/ }));
    await t.write(AUTOCOMPLETE_PRICE - 1);
    await fireEvent.click(screen.getByRole('button', { name: /^Cat\./ }));
    t.game.api.dispatch({ type: 'primaryAction' });
    t.tick(5000);
    expect(t.latest()?.run.pendingUnlockIds).toEqual(['autocomplete']);
    expect(screen.queryByRole('heading', { name: 'Autocomplete' })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: '← BACK TO CODE' }));
    expect(screen.getByRole('heading', { name: 'Autocomplete' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }));
    expect(t.latest()?.run.pendingUnlockIds).toEqual([]);
    expect(screen.queryByTestId('announcement')).toBeNull();
  });

  it('a discovery card puts CONTINUE at its top, away from the primary action', async () => {
    const t = setup();
    await t.write(5);
    await fireEvent.click(screen.getByRole('button', { name: /Autocomplete/ }));
    await t.write(AUTOCOMPLETE_PRICE);
    const card = screen.getByTestId('announcement');
    expect(card.firstElementChild?.textContent).toBe('CONTINUE');
    await fireEvent.click(within(card).getByRole('button', { name: 'CONTINUE' }));
    expect(t.latest()?.run.pendingUnlockIds).toEqual([]);
  });
});
