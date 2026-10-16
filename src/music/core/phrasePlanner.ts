/**
 * Phrase compiler: one normalized pattern + one arrangement → an immutable plan of absolute-tick
 * events (no Tone nodes). Disabled/unassigned roles and voices over the caps are dropped and
 * counted, never sent to a synth. A small horizon registry keeps current + next phrase only.
 */
import type { ArrangementDocument, PresetDocument } from '../data/patterns.generated';
import { clockFor } from './timing';
import type { NormalizedPattern } from './validation';

/** Simultaneous sounding voices across all roles (music + occasional SFX share this budget). */
export const GLOBAL_VOICE_CAP = 8;

export interface PlannedEvent {
  readonly role: string;
  readonly presetId: string;
  readonly type: 'note' | 'drum';
  readonly startTick: number;
  readonly endTick: number;
  readonly midi: number | null;
  readonly sound: 'kick' | 'snare' | 'hat' | null;
  readonly velocity: number;
}

export interface PhrasePlan {
  readonly key: string;
  readonly patternId: string;
  readonly revision: number;
  readonly eraId: string;
  readonly arrangementId: string;
  readonly bpm: number;
  readonly startTick: number;
  readonly endTick: number;
  readonly events: readonly PlannedEvent[];
  readonly dropped: number;
}

export function compilePhrase(
  pattern: NormalizedPattern,
  arrangement: ArrangementDocument,
  presets: ReadonlyMap<string, PresetDocument>,
  startTick: number,
  ppq: number,
): PhrasePlan {
  const clock = clockFor({
    ppq,
    timeSignature: pattern.timeSignature,
    stepsPerBar: pattern.stepsPerBar,
    bars: pattern.bars,
    bpm: pattern.bpm,
  });
  const base = {
    key: `${pattern.id}@${pattern.revision}`,
    patternId: pattern.id,
    revision: pattern.revision,
    eraId: pattern.eraId,
    arrangementId: arrangement.id,
    bpm: pattern.bpm,
    startTick,
  };
  if (!clock.ok) return { ...base, endTick: startTick, events: [], dropped: pattern.events.length };

  let dropped = 0;
  const candidates: PlannedEvent[] = [];
  for (const event of pattern.events) {
    const assignment = arrangement.roles[event.role];
    const preset = assignment ? presets.get(assignment.preset) : undefined;
    if (!assignment || assignment.enabled === false || !preset || event.velocity <= 0) {
      dropped += 1;
      continue;
    }
    candidates.push({
      role: event.role,
      presetId: preset.id,
      type: event.type,
      startTick: startTick + event.step * clock.ticksPerStep,
      endTick: startTick + (event.step + event.length) * clock.ticksPerStep,
      midi: event.midi,
      sound: event.sound,
      velocity: event.velocity * (assignment.level ?? 1),
    });
  }
  candidates.sort((a, b) => a.startTick - b.startTick || a.role.localeCompare(b.role));

  // Voice sweep: note-off before note-on at the same tick; enforce per-role and global caps.
  const active: PlannedEvent[] = [];
  const events: PlannedEvent[] = [];
  for (const event of candidates) {
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if ((active[i]?.endTick ?? 0) <= event.startTick) active.splice(i, 1);
    }
    const roleVoices = active.filter((a) => a.role === event.role).length;
    const polyphony = presets.get(event.presetId)?.polyphony ?? 1;
    if (active.length >= GLOBAL_VOICE_CAP || roleVoices >= polyphony) {
      dropped += 1;
      continue;
    }
    active.push(event);
    events.push(event);
  }
  return { ...base, endTick: startTick + clock.phraseTicks, events, dropped };
}

/** Registry of scheduled phrases: never more than the current and the next. */
export interface Horizon {
  add(plan: PhrasePlan): void;
  /** Forget phrases that ended at or before `tick`. */
  completeBefore(tick: number): void;
  /** Remove (cancel) phrases starting at or after `tick`; returns what was removed. */
  cancelFrom(tick: number): PhrasePlan[];
  size(): number;
  plans(): readonly PhrasePlan[];
}

export function createHorizon(limit = 2): Horizon {
  let plans: PhrasePlan[] = [];
  return {
    add(plan) {
      plans = [...plans.filter((p) => p.startTick !== plan.startTick), plan].sort(
        (a, b) => a.startTick - b.startTick,
      );
      if (plans.length > limit) throw new Error(`music horizon exceeded ${limit} phrases`);
    },
    completeBefore(tick) {
      plans = plans.filter((p) => p.endTick > tick);
    },
    cancelFrom(tick) {
      const removed = plans.filter((p) => p.startTick >= tick);
      plans = plans.filter((p) => p.startTick < tick);
      return removed;
    },
    size: () => plans.length,
    plans: () => plans,
  };
}
