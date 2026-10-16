/**
 * Cat simulation. Deliberately narrow: it receives the cat, elapsed active time and cat
 * balance only — no economy — so care can never become a productivity modifier.
 */
import type { CatBalance } from './catalog';
import { nextInt } from './random';
import type { CareNote, CatState } from './types';

export interface CatConditions {
  readonly hungry: boolean;
  readonly lonely: boolean;
  readonly attentionSeeking: boolean;
  readonly overfed: boolean;
  readonly sick: boolean;
  readonly critical: boolean;
  readonly dead: boolean;
}

export type CatEvent = { type: 'died' };

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
 */
function needsTick(cat: CatState, balance: CatBalance): { cat: CatState; died: boolean } {
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
  return {
    died,
    cat: {
      ...cat,
      fullness,
      mood: clamp(mood),
      health: clamp(health),
      overfeeding: Math.max(0, cat.overfeeding - perTick(balance.overfeedingDecayPerMinute)),
      pendingActions: 0,
      alive: !died,
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
