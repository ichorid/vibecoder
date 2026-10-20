// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUiGame, nullRenderer } from '../../tests/helpers/uiGame';
import { progressedRun } from '../../tests/browser/fixtures';
import type { GameSnapshot } from './createGame';
import App from './App.svelte';
import { catalog } from '../content/catalog';
import { createRun } from '../game/createRun';
import { selectRentWheel } from '../game/projectViews';
import ReleaseWheel from '../ui/ReleaseWheel.svelte';
import type { RunState } from '../game/types';
import { buildRow, deckItem, needDeckItem } from '../../tests/helpers/deck';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '');
});

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
  return { ...ui, latest: () => latest };
}

/** A run past the first technology with money on screen and the rent running. */
function onItsOwn(patch: Partial<RunState> = {}): RunState {
  const run = progressedRun(2, false);
  return {
    ...run,
    narrative: { ...run.narrative, fired: [...run.narrative.fired, 'first-gig'] },
    rent: { ...run.rent, movedOut: true, month: 1, nextDueMs: run.activeMs + 60_000 },
    economy: { ...run.economy, money: 240 },
    ...patch,
  };
}

describe('money on screen', () => {
  it('the stats panel at the top shows the balance and the rent; the lane holds the gig board', () => {
    const run = onItsOwn();
    const t = show(run);
    const stats = screen.getByTestId('stats');
    // One row of four at most; the rent is a small line under the money, not a cell of its own.
    expect(within(stats).getAllByRole('term').length).toBeLessThanOrEqual(4);
    const money = within(stats).getByTestId('stat-money');
    expect(money.textContent).toContain('$240');
    // Month 2 is due next: a dollar more, quietly.
    const rent = within(money).getByTestId('rent-due');
    expect(rent.textContent?.trim()).toBe('(rent: −$101 in 1:00)');
    expect(rent.getAttribute('data-alarm')).toBe('false');
    expect(screen.getByTestId('build-lane').textContent).not.toContain('$240');
    expect(t.latest()?.game.money?.gig ?? t.latest()?.game.money?.search).toBeTruthy();
    expect(deckItem('gig') ?? deckItem('search')).not.toBeNull();
  });

  it('money and rent turn red when the rent cannot be paid', () => {
    show(onItsOwn({ economy: { ...onItsOwn().economy, money: -30 } }));
    expect(screen.getByTestId('stat-money').getAttribute('data-alarm')).toBe('true');
    expect(screen.getByTestId('rent-due').getAttribute('data-alarm')).toBe('true');
  });

  it('a finished gig pops a golden "+$pay" on the money', async () => {
    const run = onItsOwn();
    const t = show({
      ...run,
      gigs: {
        ...run.gigs,
        offer: {
          size: 10,
          pay: 55,
          tier: 'normal',
          payMin: 50,
          payMax: 60,
          clientId: catalog.money.clients[0]?.id ?? 'c',
          paymentId: 'p',
        },
        search: null,
      },
      projects: { ...run.projects, gig: { code: 9.5, price: 10 } },
      slots: [{ target: 'gig', by: 'player', sinceMs: 0 }],
    });
    await fireEvent.click(screen.getByTestId('primary-action'));
    t.tick(300);
    await tick();
    expect(t.latest()?.run.economy.money).toBeGreaterThanOrEqual(295);
    const earned = [...document.querySelectorAll('[data-tone="earn"]')];
    expect(earned.map((e) => e.textContent?.trim())).toEqual(['+$55']);
    expect(earned[0]?.closest('.stats-bar')).not.toBeNull();
  });

  it('SEARCH spends a press and finds a gig after a few; tapping the gig builds it', async () => {
    const t = show(
      onItsOwn({ gigs: { offer: null, search: { done: 0, needed: 3 }, paid: 1, botMs: 0 } }),
    );
    for (let i = 0; i < 3; i += 1) {
      await fireEvent.click(needDeckItem('search'));
      t.tick(400);
    }
    const gig = needDeckItem('gig');
    expect(gig.textContent).toMatch(/\$\d+–\d+/);
    await fireEvent.click(gig);
    expect(t.latest()?.run.slots[0]?.target).toBe('gig');
    expect(buildRow().getAttribute('data-key')).toBe('gig');
  });

  it('a fallback build drifts at half speed (AUTO · ½); one tap makes it full speed', async () => {
    const base = createRun(3, 'drift');
    const t = show({ ...base, slots: [{ target: 'release', by: 'fallback', sinceMs: 0 }] });
    expect(within(buildRow()).getByTestId('project-badge').textContent).toBe('AUTO · ½');
    // The cost of not choosing is said where the choice is.
    expect(screen.getByTestId('deck-tax').textContent).toContain('at ½ while you decide');
    // The row tells more; one tap on the highlighted chip (or the details' button) confirms it.
    await fireEvent.click(buildRow());
    expect(screen.getByTestId('build-details').textContent).toContain('FULL SPEED');
    expect(t.latest()?.run.slots[0]?.by).toBe('fallback');
    await fireEvent.click(needDeckItem('release'));
    expect(screen.queryByTestId('build-details')).toBeNull();
    expect(t.latest()?.run.slots[0]).toMatchObject({ target: 'release', by: 'player' });
    expect(within(buildRow()).getByTestId('project-badge').textContent).toBe('BUILDING');
    expect(screen.queryByTestId('deck-tax')).toBeNull();
  });
});

describe('the wallet in Setup', () => {
  it('shows the balance, the work, the rent, and what was earned and spent so far', async () => {
    const run = onItsOwn();
    show({
      ...run,
      stats: { ...run.stats, earnedGigs: 300, earnedOther: 60, spentRent: 100, spentFood: 20 },
      rent: { ...run.rent, missedTotal: 1 },
    });
    await fireEvent.click(screen.getByTestId('open-setup'));
    const wallet = screen.getByTestId('setup-wallet');
    expect(within(wallet).getByTestId('wallet-balance').textContent).toContain('$240');
    expect(within(wallet).getByTestId('wallet-work').textContent).toContain('Freelance');
    const rent = within(wallet).getByTestId('wallet-rent').textContent ?? '';
    expect(rent).toContain('−$101');
    expect(rent).toContain('1:00');
    expect(rent).toContain('missed 1');
    const earned = within(wallet).getByTestId('wallet-earned').textContent ?? '';
    expect(earned).toContain('$360');
    expect(earned).toContain('gigs $300');
    expect(earned).toContain('savings $60');
    const spent = within(wallet).getByTestId('wallet-spent').textContent ?? '';
    expect(spent).toContain('$120');
    expect(spent).toContain('rent $100');
    expect(spent).toContain('cat food $20');
  });

  it('an employee sees the salary and the tryout', async () => {
    const run = onItsOwn();
    show({
      ...run,
      job: {
        ...run.job,
        employed: { salary: 400, monthEmployedMs: 0, paydays: 3, permanent: false },
      },
      slots: [{ target: 'job', by: 'player', sinceMs: 0 }],
    });
    await fireEvent.click(screen.getByTestId('open-setup'));
    const work = screen.getByTestId('wallet-work').textContent ?? '';
    expect(work).toContain('$400 a month');
    expect(work).toContain('Tryout 3/12.');
  });
});

describe('the cat costs money (on your own)', () => {
  it('FEED shows its price after moving out', async () => {
    show(onItsOwn());
    await fireEvent.click(screen.getByRole('button', { name: /^Cat\./ }));
    expect(screen.getByRole('button', { name: /FEED/ }).textContent).toContain('$2');
  });

  it('FEED floats what the food cost', async () => {
    const t = show(onItsOwn());
    await fireEvent.click(screen.getByRole('button', { name: /^Cat\./ }));
    await fireEvent.click(screen.getByRole('button', { name: /FEED/ }));
    expect(t.latest()?.run.economy.money).toBe(238);
    const float = document.querySelector('[data-testid="floating-gain"]');
    expect(float?.textContent).toBe('−$2');
    expect(float?.getAttribute('data-tone')).toBe('spend');
  });

  it('FEED floats nothing while the food is free', async () => {
    show(createRun(3, 'home'));
    await fireEvent.click(screen.getByRole('button', { name: /^Cat\./ }));
    await fireEvent.click(screen.getByRole('button', { name: /FEED/ }));
    expect(document.querySelector('[data-testid="floating-gain"]')).toBeNull();
  });
});

describe('the enterprise job', () => {
  it('an offer is a lane item with ∞ for a price; taking it starts the tryout and takes everything', async () => {
    const run = onItsOwn({
      job: {
        offer: { salary: 400, expiresAtMs: 1e9 },
        employed: null,
        awayMs: 0,
        cooldownUntilMs: null,
        fired: 0,
      },
    });
    const t = show(run);
    const card = needDeckItem('job');
    expect(card.textContent).toContain('∞');
    await fireEvent.click(card);
    expect(t.latest()?.run.job.employed).toMatchObject({ salary: 400, paydays: 0 });
    const row = buildRow();
    expect(row.getAttribute('data-key')).toBe('job');
    expect(row.textContent).toContain('TRYOUT PERIOD 0/12');
    expect(row.textContent).toContain('At work');
    expect(within(row).getByTestId('project-badge').textContent).toBe('EMPLOYED');
  });

  it('after twelve paydays the card reads PERMANENT — and nothing else changes', () => {
    const run = onItsOwn({
      job: {
        offer: null,
        employed: { salary: 400, monthEmployedMs: 0, paydays: 12, permanent: true },
        awayMs: 0,
        cooldownUntilMs: null,
        fired: 0,
      },
      slots: [{ target: 'job', by: 'player', sinceMs: 0 }],
    });
    show(run);
    expect(buildRow().textContent).toContain('PERMANENT');
    expect(buildRow().textContent).toContain('Permanent. Relax.');
  });
});

describe('the landlord wheel and market updates', () => {
  it('a missed rent opens the landlord wheel over Game, with its red slice at its true odds', () => {
    const run = onItsOwn({
      rentWheels: [
        { month: 2, outcome: 'friday', hazard: 0.05, rent: 101, catAlive: true, activeMs: 0 },
      ],
      rentWheelsSeen: 0,
    });
    show(run);
    const wheel = screen.getByRole('dialog', { name: 'Missed RENT $101' });
    expect(within(wheel).getByTestId('wheel-odds').textContent).toContain('EVICTED: 5 %');
  });

  it('the landlord wheel lands on its committed slice; BACK TO WORK acknowledges it', async () => {
    const run = onItsOwn({
      rentWheels: [
        { month: 2, outcome: 'friday', hazard: 0.05, rent: 101, catAlive: true, activeMs: 0 },
      ],
      rentWheelsSeen: 0,
    });
    const wheel = selectRentWheel(run, catalog);
    if (!wheel) throw new Error('no wheel');
    let done = 0;
    render(ReleaseWheel, {
      props: { wheel, variant: 'rent', reducedMotion: true, onDone: () => (done += 1) },
    });
    expect(screen.getByTestId('release-result').textContent).toBe('FRIDAY');
    await fireEvent.click(screen.getByRole('button', { name: 'BACK TO WORK' }));
    expect(done).toBe(1);
  });

  it('a market update uses the announcement panel', async () => {
    const run = onItsOwn({ notices: [{ kind: 'market', era: 1 }] });
    const t = show(run);
    const panel = screen.getByTestId('announcement');
    expect(panel.textContent).toContain('MARKET UPDATE');
    expect(panel.textContent).toContain(catalog.money.eras[1]?.text ?? '?');
    await fireEvent.click(within(panel).getByRole('button', { name: 'CONTINUE' }));
    expect(t.latest()?.run.notices).toEqual([]);
  });

  it('History reopens the permanent contract from its entry', async () => {
    const run = onItsOwn({
      history: [{ kind: 'milestone', id: 'permanent-contract', activeMs: 1000 }],
    });
    show(run);
    await fireEvent.click(screen.getByRole('button', { name: 'HISTORY' }));
    await fireEvent.click(screen.getByRole('button', { name: 'View Permanent contract' }));
    const panel = screen.getByTestId('announcement');
    expect(panel.textContent).toContain('HISTORIC MILESTONE');
    expect(panel.textContent).toContain('until further notice');
  });
});

describe('phones: gigs, the project, the demo and the job are in the lane', () => {
  function asPhone() {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    return () => vi.unstubAllGlobals();
  }

  it('the balance is up top; no UPGRADES button; the gig is a tap away and fills its build row', async () => {
    const restore = asPhone();
    try {
      const t = show(onItsOwn());
      expect(screen.getByTestId('stat-money').textContent).toContain('$240');
      expect(screen.queryByTestId('offers-toggle')).toBeNull();
      expect(screen.queryByTestId('offers-sheet')).toBeNull();
      // Find a gig if there is none yet, then take it.
      for (let i = 0; i < 10 && !deckItem('gig'); i += 1) {
        await fireEvent.click(needDeckItem('search'));
        t.tick(400);
      }
      await fireEvent.click(needDeckItem('gig'));
      expect(t.latest()?.run.slots[0]?.target).toBe('gig');
      for (let i = 0; i < 3; i += 1) {
        await fireEvent.click(screen.getByTestId('primary-action'));
        t.tick(400);
      }
      await tick();
      const progress = t.latest()?.game.money?.gig?.project.progress ?? 0;
      expect(progress).toBeGreaterThan(0);
      expect(buildRow().querySelector<HTMLElement>('.fill')?.style.width).toBe(
        `${Math.min(100, progress * 100)}%`,
      );
    } finally {
      restore();
    }
  });

  it('the project (Ship It) builds in the row; the demo waits in the lane', async () => {
    const restore = asPhone();
    try {
      const run = onItsOwn();
      const t = show({ ...run, slots: [{ target: 'release', by: 'player', sinceMs: 0 }] });
      expect(screen.queryByTestId('ship-strip')).toBeNull();
      for (let i = 0; i < 3; i += 1) {
        await fireEvent.click(screen.getByTestId('primary-action'));
        t.tick(400);
      }
      await tick();
      const progress = t.latest()?.game.release?.project.progress ?? 0;
      expect(progress).toBeGreaterThan(0);
      expect(buildRow().getAttribute('data-key')).toBe('release');
      expect(buildRow().querySelector<HTMLElement>('.fill')?.style.width).toBe(
        `${Math.min(100, progress * 100)}%`,
      );
      if (t.latest()?.game.demo) expect(deckItem('demo')).not.toBeNull();
    } finally {
      restore();
    }
  });

  it('a job offer is in the lane too', () => {
    const restore = asPhone();
    try {
      show(
        onItsOwn({
          job: {
            offer: { salary: 400, expiresAtMs: 1e9 },
            employed: null,
            awayMs: 0,
            cooldownUntilMs: null,
            fired: 0,
          },
        }),
      );
      expect(needDeckItem('job').textContent).toContain('$400 a month');
    } finally {
      restore();
    }
  });
});
