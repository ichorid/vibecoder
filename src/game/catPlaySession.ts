/**
 * PLAY session rules on the shared active clock: start, catch, timeout, next attempt, leave,
 * resume cue. Each attempt resolves once; mood gains commit per attempt; no completion bonus.
 */
import type { CatPlayBalance } from './catalog';
import { mousePosition, sampleAttempt, scoreAttempt } from './catPlay';
import { nextInt } from './random';
import type { CatPlayState, CatState, DeepReadonly, RunState } from './types';

export type ReadonlyPlay = DeepReadonly<CatPlayState>;

export type PlayPhase = 'ready' | 'moving' | 'result' | 'resume';

export function playPhase(play: ReadonlyPlay, at: number): PlayPhase {
  if (play.cueUntilMs !== null && at < play.cueUntilMs) return 'resume';
  if (at < play.movementOriginMs) return 'ready';
  if (play.outcome !== null || at >= play.movementEndMs) return 'result';
  return 'moving';
}

/** The single position function used by both the DOM track and scoring. */
export function playPosition(play: ReadonlyPlay, at: number): number {
  if (play.outcome !== null) return play.outcome.position;
  const sampleAt = play.cueUntilMs !== null && at < play.cueUntilMs ? play.cueUntilMs : at;
  const elapsed = Math.min(sampleAt, play.movementEndMs) - play.movementOriginMs;
  return mousePosition(play.speed, elapsed);
}

function newAttempt(
  number: number,
  id: number,
  startMs: number,
  previous: CatPlayState['previous'],
  rng: number,
  balance: CatPlayBalance,
): { play: CatPlayState; rng: number } {
  const sample = sampleAttempt(rng, balance);
  const origin = startMs + balance.readyMs;
  return {
    rng: sample.rng,
    play: {
      attemptNumber: number,
      attemptId: id,
      attemptStartMs: startMs,
      movementOriginMs: origin,
      movementEndMs: origin + balance.movementMs,
      attemptEndMs: origin + balance.movementMs + balance.resultMs,
      cueUntilMs: null,
      target: sample.attempt.target,
      speed: sample.attempt.speed,
      outcome: null,
      previous,
    },
  };
}

export interface SessionState {
  readonly play: CatPlayState | null;
  readonly cat: CatState;
  readonly rng: number;
  readonly seq: number;
}

export function startSession(
  state: SessionState,
  at: number,
  balance: CatPlayBalance,
): SessionState {
  const id = state.seq + 1;
  const attempt = newAttempt(1, id, at, [], state.rng, balance);
  return { ...state, play: attempt.play, rng: attempt.rng, seq: id };
}

export type CatchResult =
  | { readonly accepted: true; readonly kind: 'caught' | 'skipped'; readonly state: SessionState }
  | { readonly accepted: false };

/** Next attempt now, or — after the last one — end the round and start a fresh one now. */
function skipResult(
  state: SessionState,
  play: CatPlayState,
  at: number,
  balance: CatPlayBalance,
): SessionState {
  const outcomes = [...play.previous, play.outcome?.kind ?? 'miss'];
  if (play.attemptNumber < balance.attempts) {
    const id = state.seq + 1;
    const attempt = newAttempt(play.attemptNumber + 1, id, at, outcomes, state.rng, balance);
    return { ...state, play: attempt.play, rng: attempt.rng, seq: id };
  }
  const hits = outcomes.filter((o) => o === 'hit').length;
  const ended: SessionState = {
    ...state,
    play: null,
    cat: { ...state.cat, lastCare: { note: hits >= 2 ? 'playWin' : 'playLose', atActiveMs: at } },
  };
  return startSession(ended, at, balance);
}

export function catchMouse(
  state: SessionState,
  attemptId: number,
  at: number,
  balance: CatPlayBalance,
): CatchResult {
  const resolved = advanceSession(state, at, balance);
  const play = resolved.play;
  if (!play || !state.cat.alive || play.attemptId !== attemptId) return { accepted: false };
  if (play.outcome !== null) {
    // The result pause: a second CATCH (not an accidental double tap) skips it.
    if (at - play.outcome.atMs < balance.skipLockMs) return { accepted: false };
    return { accepted: true, kind: 'skipped', state: skipResult(resolved, play, at, balance) };
  }
  if (playPhase(play, at) !== 'moving') return { accepted: false };
  const position = playPosition(play, at);
  const kind = scoreAttempt(position, play.target, balance.nearMissDistance);
  let rng = resolved.rng;
  let moodGain = 0;
  if (kind === 'hit') {
    const draw = nextInt(rng, balance.hitMoodMin, balance.hitMoodMax);
    moodGain = draw.value;
    rng = draw.state;
  } else if (kind === 'near') {
    moodGain = balance.nearMissMood;
  }
  return {
    accepted: true,
    state: {
      ...resolved,
      rng,
      cat: { ...resolved.cat, mood: Math.min(100, resolved.cat.mood + moodGain) },
      // Only a short result pause follows a catch, not the rest of the movement slot.
      play: {
        ...play,
        outcome: { kind, moodGain, atMs: at, position },
        attemptEndMs: at + balance.resultMs,
      },
    },
    kind: 'caught',
  };
}

/** Advance the session to `at`: time out unresolved movement, then start the next attempt. */
export function advanceSession(
  state: SessionState,
  at: number,
  balance: CatPlayBalance,
): SessionState {
  let next = state;
  while (next.play) {
    const play: CatPlayState = next.play;
    if (play.outcome === null && at >= play.movementEndMs) {
      const position = mousePosition(play.speed, play.movementEndMs - play.movementOriginMs);
      next = {
        ...next,
        play: {
          ...play,
          outcome: { kind: 'miss', moodGain: 0, atMs: play.movementEndMs, position },
        },
      };
      continue;
    }
    if (at < play.attemptEndMs) break;
    const outcomes = [...play.previous, play.outcome?.kind ?? 'miss'];
    if (play.attemptNumber >= balance.attempts) {
      const hits = outcomes.filter((o) => o === 'hit').length;
      next = {
        ...next,
        play: null,
        cat: {
          ...next.cat,
          lastCare: { note: hits >= 2 ? 'playWin' : 'playLose', atActiveMs: play.attemptEndMs },
        },
      };
      break;
    }
    const id = next.seq + 1;
    const attempt = newAttempt(
      play.attemptNumber + 1,
      id,
      play.attemptEndMs,
      outcomes,
      next.rng,
      balance,
    );
    next = { ...next, play: attempt.play, rng: attempt.rng, seq: id };
  }
  return next;
}

/**
 * After a suspension or reload, freeze a moving attempt for a short visual cue and shift its
 * movement origin by the cue length so the mouse continues from the same position.
 */
export function resumeSession(
  state: SessionState,
  at: number,
  balance: CatPlayBalance,
): SessionState {
  const play = state.play;
  if (!play || playPhase(play, at) !== 'moving') return state;
  const shift = balance.resumeCueMs;
  return {
    ...state,
    play: {
      ...play,
      cueUntilMs: at + shift,
      movementOriginMs: play.movementOriginMs + shift,
      movementEndMs: play.movementEndMs + shift,
      attemptEndMs: play.attemptEndMs + shift,
    },
  };
}

export function sessionOf(run: RunState): SessionState {
  return { play: run.catPlay, cat: run.cat, rng: run.rng.cat, seq: run.catPlaySeq };
}

export function withSession(run: RunState, session: SessionState): RunState {
  return {
    ...run,
    catPlay: session.play,
    cat: session.cat,
    rng: { ...run.rng, cat: session.rng },
    catPlaySeq: session.seq,
  };
}
