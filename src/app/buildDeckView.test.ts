// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUiGame, nullRenderer } from '../../tests/helpers/uiGame';
import { buildRow, deckItem, needDeckItem } from '../../tests/helpers/deck';
import App from './App.svelte';
import type { GameSnapshot } from './createGame';
import { catalog } from '../content/catalog';
import { createRun } from '../game/createRun';
import type { TechnologyId } from '../game/ids';
import { selectGame } from '../game/selectors';
import type { RunState } from '../game/types';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '');
});

const ids = catalog.technologies.map((t) => t.id);
const upTo = (last: TechnologyId) => ids.slice(0, ids.indexOf(last) + 1);

/** Every technology up to `last` discovered (their cards bought), with money on screen. */
function at(last: TechnologyId, patch: Partial<RunState['economy']> = {}): RunState {
  const run = createRun(4, 'deck-ui');
  return {
    ...run,
    unlockedTechnologyIds: upTo(last),
    upgradeLevels: Object.fromEntries(upTo(last).map((id) => [id, 1])),
    economy: { ...run.economy, money: 5000, tasks: 60, ...patch },
    narrative: { ...run.narrative, fired: ['first-gig'] },
  };
}

function show(run: RunState) {
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
  const press = async (count = 1) => {
    for (let i = 0; i < count; i += 1) {
      await fireEvent.click(screen.getByTestId('primary-action'));
      ui.tick(100);
    }
    await tick();
  };
  return { ...ui, latest: () => latest, press };
}

/** A run whose first slot is one press away from finishing a plain (non-discovery) upgrade. */
function almostBuilt(last: TechnologyId): { run: RunState; key: string } {
  const run = at(last);
  const card = selectGame(run, catalog).deck.lane.find(
    (i) =>
      i.kind === 'upgrade' &&
      i.offer.project !== null &&
      !catalog.upgrades.find((u) => u.id === i.key)?.discovers,
  );
  if (!card || card.kind !== 'upgrade') throw new Error(`no plain card at ${last}`);
  const price = card.offer.price;
  return {
    key: card.key,
    run: {
      ...run,
      slots: [{ target: card.key as never, by: 'player', sinceMs: 0 }],
      projects: { [card.key]: { code: price - 0.5, price } },
    },
  };
}

describe('a build completes (docs/feature_build_deck.md §6.6, §8.1)', () => {
  it('ta-da, then the lane grows into cards and asks "what next?" with the tax in sight', async () => {
    const { run } = almostBuilt('ralph-loop');
    const t = show(run);
    expect(screen.queryByTestId('deck-expanded')).toBeNull();
    await t.press();
    expect(t.latest()?.run.slots[0]?.by).toBe('fallback');
    const open = screen.getByTestId('deck-expanded');
    expect(open.textContent).toContain('BUILT · WHAT NEXT?');
    expect(screen.getByTestId('deck-tax').textContent).toContain('at ½ while you decide');
    expect(document.querySelector('[data-testid="burst"]')?.getAttribute('data-tier')).toBe('A');
    // A pick closes it and builds at full speed.
    const card = within(open).getAllByTestId('lane-card')[0];
    if (!card) throw new Error('no card');
    const key = card.getAttribute('data-lane-card');
    await fireEvent.click(card);
    expect(screen.queryByTestId('deck-expanded')).toBeNull();
    expect(t.latest()?.run.slots[0]).toMatchObject({ target: key, by: 'player' });
  });

  it('from Manager Agent on, nothing asks: the row says who picked the next build', async () => {
    const { run } = almostBuilt('manager-agent');
    const t = show(run);
    await t.press();
    expect(t.latest()?.run.slots[0]?.by).toBe('system');
    expect(screen.queryByTestId('deck-expanded')).toBeNull();
    expect(buildRow().textContent).toContain('Manager picked');
  });

  it('a tap on the build row opens the lane in full; its head closes it', async () => {
    show(at('ralph-loop'));
    await fireEvent.click(buildRow());
    expect(screen.getByTestId('deck-expanded').textContent).toContain('WHAT NEXT?');
    await fireEvent.click(screen.getByTestId('deck-close'));
    expect(screen.queryByTestId('deck-expanded')).toBeNull();
  });
});

describe('the release is ready (§9)', () => {
  function readyRun(): RunState {
    const run = at('terminal-agent');
    const price = selectGame(run, catalog).release?.price ?? 0;
    return {
      ...run,
      slots: [{ target: 'release', by: 'player', sinceMs: 0 }],
      projects: { release: { code: price - 0.5, price } },
    };
  }

  it('pops up SHIP IT / Later once; Later leaves it READY, a tap brings it back, SHIP spins', async () => {
    const t = show(readyRun());
    await t.press();
    expect(t.latest()?.game.release?.affordable).toBe(true);
    const popup = await vi.waitFor(() => screen.getByTestId('ready-popup'), { timeout: 2000 });
    expect(popup.textContent).toContain('IS READY');
    expect(within(popup).getByTestId('ready-odds').textContent).toMatch(/retire chance/);
    await fireEvent.click(screen.getByTestId('ready-later'));
    expect(screen.queryByTestId('ready-popup')).toBeNull();
    // What next? meanwhile — and the release waits as READY.
    expect(screen.getByTestId('deck-expanded')).toBeTruthy();
    expect(buildRow().textContent).toContain('READY');
    await fireEvent.click(screen.getByTestId('deck-close'));
    await fireEvent.click(buildRow());
    await fireEvent.click(screen.getByTestId('ready-go'));
    expect(t.latest()?.run.releases).toHaveLength(1);
    expect(screen.queryByTestId('ready-popup')).toBeNull();
  });

  it('there is no SHIP or RUN button outside the popup', () => {
    show(readyRun());
    expect(screen.queryByRole('button', { name: /^SHIP$|^RUN$/ })).toBeNull();
    expect(screen.queryByTestId('ship-go')).toBeNull();
  });
});

describe('the token gauge (§7)', () => {
  it('is not there before tokens cost money', () => {
    show(at('generated-snippets'));
    expect(screen.queryByTestId('token-gauge')).toBeNull();
  });

  it('reloads at any time with one tap', async () => {
    const t = show(at('ralph-loop', { tokens: 100_000 }));
    const gauge = screen.getByTestId('token-gauge');
    expect(gauge.getAttribute('data-state')).toBe('full');
    const before = t.latest()?.run.economy.money ?? 0;
    await fireEvent.click(within(gauge).getByTestId('token-reload'));
    expect(t.latest()?.run.economy.tokens).toBeGreaterThan(100_000);
    expect(t.latest()?.run.economy.money).toBeLessThan(before);
  });

  it('empty and broke: the agents sleep in the world, and the button goes for a gig', async () => {
    const base = at('ralph-loop', { tokens: 0, money: 0 });
    const t = show({
      ...base,
      gigs: {
        offer: {
          size: 40,
          pay: 50,
          tier: 'normal',
          payMin: 40,
          payMax: 60,
          clientId: catalog.money.clients[0]?.id ?? 'c',
          paymentId: 'p',
        },
        search: null,
        paid: 1,
        botMs: 0,
      },
    });
    expect(screen.getByTestId('token-gauge').getAttribute('data-state')).toBe('noMoney');
    expect(screen.getByTestId('agents-idle')).toBeTruthy();
    await fireEvent.click(screen.getByTestId('token-earn'));
    expect(t.latest()?.run.slots.some((s) => s.target === 'gig')).toBe(true);
  });
});

describe('the lane (§6)', () => {
  it('a decision opens in full from the lane; DECIDE (and YES) commits it', async () => {
    const t = show(at('reviewer'));
    const item = needDeckItem('choice:keep-manual');
    await fireEvent.click(item);
    const popup = screen.getByTestId('choice-popup');
    await fireEvent.click(within(popup).getByTestId('choice-decide'));
    const yes = within(screen.getByTestId('choice-popup')).queryByRole('button', { name: 'YES' });
    if (yes) await fireEvent.click(yes);
    expect(t.latest()?.run.choices['keep-manual']).toBeDefined();
    expect(screen.queryByTestId('choice-popup')).toBeNull();
  });

  it('a new item arrives at the end of a lane that fits, tagged NEW', async () => {
    const t = show(createRun(7, 'arrive'));
    expect(deckItem('autocomplete')).toBeNull();
    for (let i = 0; i < 20 && !deckItem('autocomplete'); i += 1) await t.press();
    const item = needDeckItem('autocomplete');
    const keys = [...document.querySelectorAll<HTMLElement>('[data-lane-key]')].map(
      (el) => el.dataset.laneKey,
    );
    expect(keys.at(-1)).toBe('autocomplete');
    await vi.waitFor(() => expect(item.textContent).toContain('NEW'), { timeout: 2000 });
  });

  it('wraps on a wide screen and scrolls on a phone', () => {
    show(at('ralph-loop'));
    expect(screen.getByTestId('build-deck').classList.contains('wrap')).toBe(true);
    cleanup();
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    show(at('ralph-loop'));
    expect(screen.getByTestId('build-deck').classList.contains('wrap')).toBe(false);
  });

  it('two worktrees: tapping a row focuses its slot; the next pick goes there', async () => {
    const run = at('worktrees');
    const lane = selectGame(run, catalog).deck.lane.filter(
      (i) => i.kind === 'upgrade' && i.offer.project,
    );
    const [first, second] = lane;
    if (!first || !second) throw new Error('two cards needed');
    const t = show({
      ...run,
      slots: [
        { target: first.key as never, by: 'player', sinceMs: 0 },
        { target: 'release', by: 'player', sinceMs: 100 },
      ],
    });
    await fireEvent.click(buildRow(1));
    const card = document.querySelector<HTMLElement>(`[data-lane-card="${second.key}"]`);
    if (!card) throw new Error('no card');
    await fireEvent.click(card);
    expect(t.latest()?.run.slots.map((s) => s.target)).toEqual([first.key, second.key]);
  });
});
