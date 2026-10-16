// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EndingViewModel, ReleaseWheelViewModel } from '../game/selectors';
import EndingPanel from './EndingPanel.svelte';
import ReleaseWheel from './ReleaseWheel.svelte';

afterEach(cleanup);

const slices = [
  ...['3 USERS', '1 STAR', 'HN', '#47', 'VIRAL!', 'ACQUIRED', '$400', 'PIVOT', 'NO REVIEW'].map(
    (label, i) => ({ id: `s${i}`, label, gold: false }),
  ),
  { id: 'jackpot', label: 'RETIRE', gold: true },
];

function wheel(overrides: Partial<ReleaseWheelViewModel['result']> = {}): ReleaseWheelViewModel {
  return {
    window: 1,
    version: 'v0.1',
    hazard: 0.002,
    slices,
    target: 3,
    spinSeed: 7,
    result: {
      jackpot: false,
      label: '#47',
      text: '#47 product of the day, right behind a to-do app.',
      comment: 'Hey! It compiles! Ship it!',
      ...overrides,
    },
  };
}

describe('release wheel', () => {
  it('with reduced motion rests on the result at once: label, line, comment and the true odds', () => {
    const sound = vi.fn();
    const onDone = vi.fn();
    render(ReleaseWheel, { props: { wheel: wheel(), reducedMotion: true, sound, onDone } });
    expect(screen.getByTestId('release-wheel').getAttribute('data-phase')).toBe('result');
    expect(screen.getByTestId('release-result').textContent).toBe('#47');
    expect(document.body.textContent).toContain('right behind a to-do app');
    expect(document.body.textContent).toContain('Top comment: “Hey! It compiles! Ship it!”');
    expect(screen.getByTestId('wheel-odds').textContent).toContain('RETIRE: 0.2 %');
    expect(sound).toHaveBeenCalledWith('release');
    expect(sound).not.toHaveBeenCalledWith('tick');
  });

  it('BACK TO WORK closes the wheel', async () => {
    const onDone = vi.fn();
    render(ReleaseWheel, { props: { wheel: wheel(), reducedMotion: true, onDone } });
    await fireEvent.click(screen.getByRole('button', { name: 'BACK TO WORK' }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('a jackpot result says RETIRE and continues to the ending', async () => {
    const onDone = vi.fn();
    const sound = vi.fn();
    render(ReleaseWheel, {
      props: {
        wheel: wheel({ jackpot: true, label: 'RETIRE', text: '', comment: null }),
        reducedMotion: true,
        sound,
        onDone,
      },
    });
    expect(screen.getByTestId('release-result').textContent).toBe('RETIRE');
    expect(document.body.textContent).not.toContain('Top comment');
    expect(sound).toHaveBeenCalledWith('jackpot');
    await fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('spins (no result yet) when motion is allowed', () => {
    render(ReleaseWheel, { props: { wheel: wheel(), reducedMotion: false, onDone: () => {} } });
    expect(screen.getByTestId('release-wheel').getAttribute('data-phase')).toBe('spinning');
    expect(screen.queryByTestId('release-result')).toBeNull();
  });
});

describe('ending picture', () => {
  const ending = (illustrationId: string | null): EndingViewModel => ({
    id: 'the-infinite-weekend',
    title: 'The Infinite Weekend',
    paragraphs: ['One release, out of nowhere, took off.'],
    illustrationId,
    experience: null,
  });

  it('shows the variant the selector chose, and nothing for endings without a picture', () => {
    const url = (id: string) => `/assets/${id}.png`;
    render(EndingPanel, {
      props: { ending: ending('ending-infinite-weekend-nocat'), illustrationUrl: url },
    });
    expect(screen.getByTestId('ending-picture').getAttribute('src')).toBe(
      '/assets/ending-infinite-weekend-nocat.png',
    );
    cleanup();
    render(EndingPanel, { props: { ending: ending(null), illustrationUrl: url } });
    expect(screen.queryByTestId('ending-picture')).toBeNull();
  });
});
