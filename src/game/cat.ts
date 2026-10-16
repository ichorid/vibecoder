/**
 * Cat simulation. Deliberately narrow: it receives the cat, elapsed active time and cat
 * balance only — no economy — so care can never become a productivity modifier.
 */
import type { AttentionBalance, CatBalance } from './catalog';
import { nextInt } from './random';
import type { AttentionLevel, AttentionState, CareNote, CatState } from './types';

export interface CatConditions {
  readonly hungry: boolean;
  readonly lonely: boolean;
  readonly attentionSeeking: boolean;
  readonly overfed: boolean;
  readonly sick: boolean;
  readonly critical: boolean;
  readonly dead: boolean;
}

export type CatEvent = { type: 'died' } | { type: 'left' };

export interface CatUpdate {
  readonly cat: CatState;
  readonly events: readonly CatEvent[];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/** Overlapping conditions derived from numbers; animation never decides them. */
export function catConditions(cat: CatState, balance: CatBalance): CatConditions {
  return {
    hungry: cat.fullness < balance.hungryBelow,
    lonely: cat.mood < balance.lonelyBelow,
    attentionSeeking: cat.mood < balance.attentionBelow,
    overfed: cat.overfeeding >= balance.overfedAt,
    sick: cat.overfeeding >= balance.sickAt,
    critical: cat.health < balance.criticalBelow,
    dead: !cat.alive,
  };
}

/** A meaningful primary/upgrade action slightly accelerates the next needs tick. */
export function noteMeaningfulAction(cat: CatState): CatState {
  if (!cat.alive) return cat;
  return { ...cat, pendingActions: cat.pendingActions + 1 };
}

/**
 * One needs tick, in a fixed explicit order:
 * 1. fullness/mood decay (with the capped action modifier), 2. overfeeding pressure decays,
 * 3. sickness (from the tick's starting pressure) costs mood and health down to a floor,
 * 4. starvation damage from the decayed fullness, 5. recovery when fed and not sick,
 * 6. terminal death at zero health. Only starvation can bring health to zero.
 * 7. being ignored: continuous time asking for attention (mood below `attentionBelow`) while not
 *    critically weak; at the limit the cat leaves.
 */
function needsTick(
  cat: CatState,
  balance: CatBalance,
): { cat: CatState; died: boolean; left: boolean } {
  const perTick = (perMinute: number) => (perMinute * balance.needsTickMs) / 60_000;
  const modifier = Math.min(
    balance.accelerationCap,
    cat.pendingActions * balance.accelerationPerAction,
  );
  const sick = cat.overfeeding >= balance.sickAt;
  const fullness = clamp(cat.fullness - balance.fullnessDecayPerTick * (1 + modifier));
  let mood = cat.mood - balance.moodDecayPerTick * (1 + modifier);
  let health = cat.health;

  if (sick) {
    mood -= perTick(balance.sicknessMoodPerMinute);
    if (health > balance.sicknessHealthFloor) {
      health = Math.max(
        balance.sicknessHealthFloor,
        health - perTick(balance.sicknessHealthPerMinute),
      );
    }
  }
  if (fullness <= balance.severeStarvationAtOrBelow) {
    health -= perTick(balance.severeStarvationHealthPerMinute);
  } else if (fullness < balance.starvationBelow) {
    health -= perTick(balance.starvationHealthPerMinute);
  } else if (fullness > balance.recoveryAbove && !sick) {
    health += perTick(balance.recoveryHealthPerMinute);
  }

  const died = health <= 0;
  const strong = health >= balance.criticalBelow;
  const ignoredMs =
    strong && clamp(mood) < balance.attentionBelow ? cat.ignoredMs + balance.needsTickMs : 0;
  const left = !died && ignoredMs >= balance.strayAfterIgnoredMs;
  return {
    died,
    left,
    cat: {
      ...cat,
      fullness,
      ignoredMs,
      mood: clamp(mood),
      health: clamp(health),
      overfeeding: Math.max(0, cat.overfeeding - perTick(balance.overfeedingDecayPerMinute)),
      pendingActions: 0,
      alive: !died && !left,
    },
  };
}

/** Accumulate active time and resolve every due needs tick. */
export function updateCat(cat: CatState, elapsedMs: number, balance: CatBalance): CatUpdate {
  if (!cat.alive) return { cat, events: [] };
  let next: CatState = { ...cat, needsElapsedMs: cat.needsElapsedMs + elapsedMs };
  while (next.needsElapsedMs >= balance.needsTickMs && next.alive) {
    const ticked = needsTick(
      { ...next, needsElapsedMs: next.needsElapsedMs - balance.needsTickMs },
      balance,
    );
    next = ticked.cat;
    if (ticked.died) return { cat: { ...next, needsElapsedMs: 0 }, events: [{ type: 'died' }] };
    if (ticked.left) return { cat: { ...next, needsElapsedMs: 0 }, events: [{ type: 'left' }] };
  }
  return { cat: next, events: [] };
}

export type CareResult =
  | { readonly accepted: true; readonly cat: CatState; readonly rng: number }
  | { readonly accepted: false; readonly reason: 'unavailable' | 'cooldown' };

/**
 * FEED: seeded 18–32 fullness, capped at 100. Excess-food pressure is added on every accepted
 * meal that starts nearly full or substantially overflows, so spamming is never safe. A short
 * eating lock absorbs duplicate touch events without consuming randomness.
 */
export function feedCat(cat: CatState, rng: number, at: number, balance: CatBalance): CareResult {
  if (!cat.alive) return { accepted: false, reason: 'unavailable' };
  if (cat.lastFedAtActiveMs !== null && at - cat.lastFedAtActiveMs < balance.feedLockMs) {
    return { accepted: false, reason: 'cooldown' };
  }
  const draw = nextInt(rng, balance.feedMin, balance.feedMax);
  const overflow = cat.fullness + draw.value - 100;
  const excessive =
    cat.fullness >= balance.overfeedFullnessAt || overflow >= balance.overfeedOverflowAt;
  const overfeeding = cat.overfeeding + (excessive ? balance.overfeedPressure : 0);
  let note: CareNote = 'nom';
  if (excessive) note = overfeeding >= balance.overfedAt ? 'spherical' : 'tooMuch';
  else if (cat.fullness >= balance.lonelyBelow) note = 'notHungry';
  return {
    accepted: true,
    rng: draw.state,
    cat: {
      ...cat,
      fullness: clamp(cat.fullness + draw.value),
      overfeeding,
      lastFedAtActiveMs: at,
      lastCare: { note, atActiveMs: at },
    },
  };
}

/** PET: small mood gain once per cooldown; taps during cooldown are cosmetic only. */
export function petCat(cat: CatState, at: number, balance: CatBalance): CareResult {
  if (!cat.alive) return { accepted: false, reason: 'unavailable' };
  if (cat.lastPetAtActiveMs !== null && at - cat.lastPetAtActiveMs < balance.petCooldownMs) {
    return { accepted: false, reason: 'cooldown' };
  }
  return {
    accepted: true,
    rng: 0,
    cat: {
      ...cat,
      mood: clamp(cat.mood + balance.petMood),
      lastPetAtActiveMs: at,
      lastCare: { note: 'purr', atActiveMs: at },
    },
  };
}

const NO_ATTENTION = { nextAtMs: null, visibleUntilMs: null, level: null } as const;

/**
 * Foreground intrusions on the active clock: below mood 40 small ones, below 20 large ones,
 * each for a short time with an interval before the next (the first after one interval).
 * Time spent away from Game is not queued: only the current window can be visible. A critically
 * weak cat stops asking.
 */
export function updateAttention(
  attention: AttentionState,
  cat: CatState,
  at: number,
  balance: AttentionBalance,
): AttentionState {
  // A critically weak cat no longer asks for anything; it just lies there.
  const level: AttentionLevel | null =
    !cat.alive || cat.health < balance.quietBelowHealth
      ? null
      : cat.mood < balance.largeBelowMood
        ? 'large'
        : cat.mood < balance.smallBelowMood
          ? 'small'
          : null;
  if (level === null) {
    return attention.nextAtMs === null && attention.visibleUntilMs === null
      ? attention
      : { ...attention, ...NO_ATTENTION };
  }
  const interval = level === 'large' ? balance.largeIntervalMs : balance.smallIntervalMs;
  const duration = level === 'large' ? balance.largeDurationMs : balance.smallDurationMs;
  let next = attention;
  if (next.nextAtMs === null) next = { ...next, nextAtMs: at + interval };
  else if (next.nextAtMs > at + interval) next = { ...next, nextAtMs: at + interval };
  if (next.visibleUntilMs !== null && at >= next.visibleUntilMs) {
    next = { ...next, visibleUntilMs: null, level: null };
  }
  if (next.nextAtMs !== null && at >= next.nextAtMs) {
    next = {
      nextAtMs: at + interval,
      visibleUntilMs: at + duration,
      level,
      count: next.count + 1,
    };
  }
  return next;
}

/** The intrusion visible at `at`, if any. */
export function visibleAttention(attention: AttentionState, at: number): AttentionLevel | null {
  return attention.visibleUntilMs !== null && at < attention.visibleUntilMs
    ? attention.level
    : null;
}
