// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createUiGame, nullRenderer } from '../../tests/helpers/uiGame';
import { progressedRun } from '../../tests/browser/fixtures';
import type { GameSnapshot } from './createGame';
import App from './App.svelte';
import { catalog } from '../content/catalog';
import { createRun } from '../game/createRun';
import { selectRentWheel } from '../game/projectViews';
import ReleaseWheel from '../ui/ReleaseWheel.svelte';
import type { RunState } from '../game/types';

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
  it('the money strip shows the balance, rent day and the gig board', () => {
    const run = onItsOwn();
    const t = show(run);
    const strip = screen.getByTestId('money-strip');
    expect(within(strip).getByTestId('money-balance').textContent).toBe('$240');
    // Month 2 is due next: a dollar more, quietly.
    expect(within(strip).getByTestId('rent-due').textContent).toContain('$101 in 1:00');
    expect(t.latest()?.game.money?.gig ?? t.latest()?.game.money?.search).toBeTruthy();
  });

  it('SEARCH spends a press and finds a gig after a few; tapping the gig builds it', async () => {
    const t = show(
      onItsOwn({ gigs: { offer: null, search: { done: 0, needed: 3 }, paid: 1, botMs: 0 } }),
    );
    for (let i = 0; i < 3; i += 1) {
      await fireEvent.click(screen.getByTestId('search-job'));
      t.tick(400);
    }
    const gig = screen.getByTestId('gig');
    expect(gig.textContent).toMatch(/\$\d+–\d+/);
    await fireEvent.click(gig);
    expect(t.latest()?.run.slots[0]?.target).toBe('gig');
  });

  it('a fallback build drifts at half speed (AUTO · ½); one tap makes it full speed', async () => {
    const base = createRun(3, 'drift');
    const t = show({ ...base, slots: [{ target: 'release', by: 'fallback', sinceMs: 0 }] });
    const strip = screen.getByTestId('ship-strip');
    expect(within(strip).getByTestId('project-badge').textContent).toBe('AUTO · ½');
    await fireEvent.click(screen.getByTestId('ship-build'));
    expect(t.latest()?.run.slots[0]).toMatchObject({ target: 'release', by: 'player' });
    expect(within(screen.getByTestId('ship-strip')).getByTestId('project-badge').textContent).toBe(
      'BUILDING',
    );
  });
});

describe('the enterprise job', () => {
  it('an offer is a card with ∞ for a price; taking it starts the tryout and takes everything', async () => {
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
    const card = screen.getByTestId('job-card');
    expect(within(card).getByTestId('job-price').textContent).toBe('∞');
    await fireEvent.click(card);
    expect(t.latest()?.run.job.employed).toMatchObject({ salary: 400, paydays: 0 });
    const employed = screen.getByTestId('job-card');
    expect(within(employed).getByTestId('job-tryout').textContent).toContain('TRYOUT PERIOD 0/12');
    expect(within(employed).getByTestId('project-badge').textContent).toBe('EMPLOYED');
    expect(screen.getByTestId('money-strip').textContent).toContain('Employed');
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
    expect(screen.getByTestId('job-permanent').textContent).toContain('Permanent. Relax.');
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
