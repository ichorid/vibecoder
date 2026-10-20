import { describe, expect, it } from 'vitest';
import {
  AIM_HOLD_MS,
  ARRIVAL_GAP_MS,
  arrivalReady,
  isTap,
  peekIndex,
  reconcileLane,
  TAP_SLOP_PX,
} from './buildLane';

describe('lane order (docs/feature_build_deck.md §6.3)', () => {
  it('starts in the model order and reports nothing as new', () => {
    expect(reconcileLane(null, ['a', 'b', 'c'], 0)).toEqual({ order: ['a', 'b', 'c'], added: [] });
  });

  it('a new item goes in at the peek position; items left of it never move', () => {
    const next = reconcileLane(['a', 'b', 'c', 'd'], ['n', 'a', 'b', 'c', 'd'], 2);
    expect(next.order).toEqual(['a', 'b', 'n', 'c', 'd']);
    expect(next.added).toEqual(['n']);
  });

  it('at the end when everything is visible (the peek index is past the end)', () => {
    expect(reconcileLane(['a', 'b'], ['a', 'b', 'n'], 99).order).toEqual(['a', 'b', 'n']);
  });

  it('several new items keep their model order at the insert position', () => {
    expect(reconcileLane(['a'], ['m', 'n', 'a'], 1).order).toEqual(['a', 'm', 'n']);
  });

  it('a removed item closes the gap', () => {
    expect(reconcileLane(['a', 'b', 'c'], ['a', 'c'], 3).order).toEqual(['a', 'c']);
  });

  it('never re-sorts when the model order changes (prices, ETAs, priorities)', () => {
    expect(reconcileLane(['a', 'b', 'c'], ['c', 'a', 'b'], 0).order).toEqual(['a', 'b', 'c']);
  });
});

describe('the peek index', () => {
  it('is the first item not fully visible; the end when all are', () => {
    expect(peekIndex([100, 200, 300, 400], 250)).toBe(2);
    expect(peekIndex([100, 200], 250)).toBe(2);
    expect(peekIndex([], 250)).toBe(0);
  });
});

describe('arrivals wait while the player aims (§6.5)', () => {
  const idle = { pressing: false, lastTouchMs: -1e9, lastArrivalMs: -1e9 };

  it('run at once when the lane is untouched', () => {
    expect(arrivalReady(idle, 0)).toBe(true);
  });

  it('wait during a press and for a second after the last touch', () => {
    expect(arrivalReady({ ...idle, pressing: true }, 0)).toBe(false);
    expect(arrivalReady({ ...idle, lastTouchMs: 0 }, AIM_HOLD_MS - 1)).toBe(false);
    expect(arrivalReady({ ...idle, lastTouchMs: 0 }, AIM_HOLD_MS)).toBe(true);
  });

  it('come one at a time', () => {
    expect(arrivalReady({ ...idle, lastArrivalMs: 0 }, ARRIVAL_GAP_MS - 1)).toBe(false);
    expect(arrivalReady({ ...idle, lastArrivalMs: 0 }, ARRIVAL_GAP_MS)).toBe(true);
  });
});

describe('tap or drag (§6.4)', () => {
  it('a pick needs less than the slop of movement', () => {
    expect(isTap(0, 0)).toBe(true);
    expect(isTap(TAP_SLOP_PX - 1, 0)).toBe(true);
    expect(isTap(TAP_SLOP_PX, 0)).toBe(false);
    expect(isTap(6, 8)).toBe(false);
  });
});
