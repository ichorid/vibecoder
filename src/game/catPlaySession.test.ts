import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { steps } from '../../tests/helpers/run';
import { mousePosition } from './catPlay';
import { playPhase, playPosition } from './catPlaySession';
import { applyCommand } from './commands';
import { createRun } from './createRun';
import type { CatPlayState, RunState } from './types';

const balance = catalog.balance.catPlay;

function started(mood = 50, seed = 3): RunState {
  const base = createRun(seed, 'r');
  const run = { ...base, cat: { ...base.cat, mood } };
  const result = applyCommand(run, { type: 'startCatPlay' }, run.activeMs, catalog);
  expect(result.result).toBe('applied');
  return result.run;
}

function play(run: RunState): CatPlayState {
  if (!run.catPlay) throw new Error('no session');
  return run.catPlay;
}

/** Advance to the first moment in the movement phase where the mouse is inside the target. */
function toHitMoment(run: RunState): RunState {
  let next = run;
  for (let i = 0; i < 200; i += 1) {
    const p = play(next);
    if (playPhase(p, next.activeMs) === 'moving') {
      const pos = playPosition(p, next.activeMs);
      const { start, width } = p.target;
      if (pos > start + 0.01 && pos < start + width - 0.01) return next;
    }
    next = steps(next, 1, catalog);
  }
  throw new Error('mouse never entered the target');
}

/** Advance to a moving moment far from the target (a clear miss). */
function toMissMoment(run: RunState): RunState {
  let next = run;
  for (let i = 0; i < 200; i += 1) {
    const p = play(next);
    if (playPhase(p, next.activeMs) === 'moving') {
      const pos = playPosition(p, next.activeMs);
      const { start, width } = p.target;
      if (pos < start - 0.08 || pos > start + width + 0.08) return next;
    }
    next = steps(next, 1, catalog);
  }
  throw new Error('no clear miss moment');
}

function catchNow(run: RunState) {
  return applyCommand(
    run,
    { type: 'catchMouse', attemptId: play(run).attemptId },
    run.activeMs,
    catalog,
  );
}

describe('PLAY session', () => {
  it('goes ready → moving → result for each attempt', () => {
    const run = started();
    const p = play(run);
    expect(p.attemptNumber).toBe(1);
    expect(playPhase(p, run.activeMs)).toBe('ready');
    expect(playPhase(p, run.activeMs + balance.readyMs)).toBe('moving');
    expect(playPhase(p, run.activeMs + balance.readyMs + balance.movementMs)).toBe('result');
  });

  it('runs exactly three attempts, a miss on timeout, then ends with no bonus', () => {
    let run = started();
    const mood = run.cat.mood;
    const ids = new Set<number>();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect(play(run).attemptNumber).toBe(attempt);
      ids.add(play(run).attemptId);
      run = steps(run, (balance.readyMs + balance.movementMs + balance.resultMs) / 100, catalog);
    }
    expect(ids.size).toBe(3);
    expect(run.catPlay).toBeNull();
    expect(run.cat.mood).toBeLessThanOrEqual(mood);
  });

  it('scores a hit with a seeded 8–12 mood gain committed immediately', () => {
    const run = toHitMoment(started(50));
    const result = catchNow(run);
    expect(result.result).toBe('applied');
    const gain = result.run.cat.mood - run.cat.mood;
    expect(Number.isInteger(gain)).toBe(true);
    expect(gain).toBeGreaterThanOrEqual(8);
    expect(gain).toBeLessThanOrEqual(12);
    expect(play(result.run).outcome?.kind).toBe('hit');
  });

  it('gives nothing for a clear miss, and rejects a duplicate or stale attempt', () => {
    const run = toMissMoment(started(50));
    const missed = catchNow(run);
    expect(missed.run.cat.mood).toBe(run.cat.mood);
    expect(play(missed.run).outcome?.kind).toBe('miss');
    const again = catchNow(missed.run);
    expect(again.result).toBe('unavailable');
    expect(again.run).toBe(missed.run);
    const stale = applyCommand(
      missed.run,
      { type: 'catchMouse', attemptId: 999 },
      missed.run.activeMs,
      catalog,
    );
    expect(stale.result).toBe('unavailable');
  });

  it('awards +1 for a near miss', () => {
    let run = started(50, 8);
    for (let i = 0; i < 200; i += 1) {
      const p = play(run);
      const t = run.activeMs;
      if (playPhase(p, t) === 'moving') {
        const pos = playPosition(p, t);
        const end = p.target.start + p.target.width;
        const distance = pos < p.target.start ? p.target.start - pos : pos - end;
        if (pos < p.target.start || pos > end) {
          if (distance > 0.005 && distance < 0.025) break;
        }
      }
      run = steps(run, 1, catalog);
    }
    // Probe with the exact millisecond inside this step that is a near miss.
    const p = play(run);
    let at = run.activeMs;
    for (; at < run.activeMs + 100; at += 1) {
      const pos = mousePosition(p.speed, at - p.movementOriginMs);
      const end = p.target.start + p.target.width;
      const distance = pos < p.target.start ? p.target.start - pos : pos - end;
      if ((pos < p.target.start || pos > end) && distance <= 0.03) break;
    }
    const result = applyCommand(run, { type: 'catchMouse', attemptId: p.attemptId }, at, catalog);
    expect(play(result.run).outcome?.kind).toBe('near');
    expect(result.run.cat.mood - run.cat.mood).toBe(1);
  });

  it('gives 24–36 for three hits without cap, and caps mood at 100', () => {
    let run = started(30);
    const before = run.cat.mood;
    const startMs = run.activeMs;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      run = catchNow(toHitMoment(run)).run;
      while (run.catPlay && play(run).attemptNumber === attempt + 1) run = steps(run, 1, catalog);
    }
    const gained = run.cat.mood - before;
    // Ordinary mood decay keeps running during the session (at most one extra needs tick).
    const cat = catalog.balance.cat;
    const ticks = Math.ceil((run.activeMs - startMs) / cat.needsTickMs) + 1;
    expect(gained).toBeGreaterThanOrEqual(24 - ticks * cat.moodDecayPerTick * 1.1);
    expect(gained).toBeLessThanOrEqual(36);
    const capped = catchNow(toHitMoment(started(97))).run;
    expect(capped.cat.mood).toBe(100);
  });

  it('after a catch only a short result pause follows, not the rest of the movement', () => {
    const run = toHitMoment(started());
    const hit = catchNow(run).run;
    expect(play(hit).attemptEndMs).toBe(hit.activeMs + balance.resultMs);
    const after = steps(hit, balance.resultMs / 100, catalog);
    expect(play(after).attemptNumber).toBe(2);
  });

  it('CATCH during the result pause starts the next attempt at once, for no mood', () => {
    const run = toHitMoment(started());
    const hit = catchNow(run).run;
    const tooSoon = applyCommand(
      hit,
      { type: 'catchMouse', attemptId: play(hit).attemptId },
      hit.activeMs + balance.skipLockMs - 1,
      catalog,
    );
    expect(tooSoon.result).toBe('unavailable');
    const at = hit.activeMs + balance.skipLockMs;
    const skipped = applyCommand(
      hit,
      { type: 'catchMouse', attemptId: play(hit).attemptId },
      at,
      catalog,
    );
    expect(skipped.result).toBe('applied');
    expect(skipped.facts).toEqual([]);
    expect(skipped.run.cat.mood).toBe(hit.cat.mood);
    expect(play(skipped.run)).toMatchObject({ attemptNumber: 2, attemptStartMs: at });
    expect(play(skipped.run).previous).toEqual(['hit']);
  });

  it('CATCH during the last result pause ends the round and starts a fresh one', () => {
    let run = started();
    for (let attempt = 1; attempt <= balance.attempts; attempt += 1) {
      run = catchNow(toHitMoment(run)).run;
      if (attempt < balance.attempts) {
        run = applyCommand(
          run,
          { type: 'catchMouse', attemptId: play(run).attemptId },
          run.activeMs + balance.skipLockMs,
          catalog,
        ).run;
        run = { ...run, activeMs: run.activeMs + balance.skipLockMs };
      }
    }
    const at = run.activeMs + balance.skipLockMs;
    const again = applyCommand(
      run,
      { type: 'catchMouse', attemptId: play(run).attemptId },
      at,
      catalog,
    );
    expect(again.result).toBe('applied');
    expect(play(again.run)).toMatchObject({ attemptNumber: 1, attemptStartMs: at, previous: [] });
    expect(again.run.cat.lastCare?.note).toBe('playWin');
  });

  it('cancels remaining attempts on leave without a bonus', () => {
    const run = catchNow(toHitMoment(started(40))).run;
    const left = applyCommand(run, { type: 'leaveCatPlay' }, run.activeMs, catalog);
    expect(left.result).toBe('applied');
    expect(left.run.catPlay).toBeNull();
    expect(left.run.cat.mood).toBe(run.cat.mood);
  });

  it('refuses to start a second session or play with a dead cat', () => {
    const run = started();
    expect(applyCommand(run, { type: 'startCatPlay' }, run.activeMs, catalog).result).toBe(
      'unavailable',
    );
    const base = createRun(1, 'r');
    const dead = { ...base, cat: { ...base.cat, alive: false, health: 0, diedAtActiveMs: 0 } };
    expect(applyCommand(dead, { type: 'startCatPlay' }, 0, catalog).result).toBe('unavailable');
  });

  it('each next attempt in a session is faster with a narrower band, and stays fair', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      let run = started(50, seed);
      const attempts: CatPlayState[] = [play(run)];
      while (attempts.length < balance.attempts) {
        run = steps(run, 1, catalog);
        const current = play(run);
        if (current.attemptNumber > attempts.length) attempts.push(current);
      }
      for (let i = 1; i < attempts.length; i += 1) {
        const before = attempts[i - 1];
        const now = attempts[i];
        if (!before || !now) throw new Error('missing attempt');
        expect(now.speed).toBeGreaterThan(before.speed);
        expect(now.target.width).toBeLessThan(before.target.width);
      }
      for (const attempt of attempts) {
        const crossingMs = (attempt.target.width / attempt.speed) * 1000;
        expect(crossingMs).toBeGreaterThanOrEqual(balance.minHitWindowMs - 1e-6);
        expect(attempt.target.start + attempt.target.width).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});
