/**
 * Fake backend with Tone-like lookahead: a phrase is *committed* when its start callback runs
 * `lookaheadTicks` before its start, and *audible* at its start tick. Time moves only via
 * `advanceTo`, never by real waiting.
 */
import type { PhrasePlan } from '../../../src/music/core/phrasePlanner';
import type { MusicBackendPort, PhraseHandle } from '../../../src/music/backend/port';

interface Entry {
  handle: PhraseHandle;
  plan: PhrasePlan;
  onAudible: (plan: PhrasePlan) => void;
  onCommit?: ((plan: PhrasePlan) => void) | undefined;

  committed: boolean;
  audible: boolean;
}

export function createFakeBackend(lookaheadTicks = 48) {
  let position = 0;
  let state: 'stopped' | 'started' | 'paused' = 'stopped';
  let nextId = 1;
  let entries: Entry[] = [];
  const log: string[] = [];
  const cancelled: string[] = [];
  const tempoLog: string[] = [];
  let bpm: number | null = null;
  const port: MusicBackendPort = {
    ppq: 192,
    loadPresets() {},
    schedulePhrase(plan, onAudible, onCommit) {
      const handle = {
        id: nextId,
        key: plan.key,
        startTick: plan.startTick,
        endTick: plan.endTick,
      };
      nextId += 1;
      entries.push({ handle, plan, onAudible, onCommit, committed: false, audible: false });
      log.push(`schedule ${plan.key} ${plan.arrangementId} @${plan.startTick}`);
      return handle;
    },
    isCommitted: (handle) => entries.find((e) => e.handle.id === handle.id)?.committed ?? true,
    cancelPhrase(handle) {
      const entry = entries.find((e) => e.handle.id === handle.id);
      if (!entry) return;
      if (entry.committed) throw new Error('cancelled a committed phrase');
      entries = entries.filter((e) => e !== entry);
      cancelled.push(`${entry.plan.key}@${entry.plan.startTick}`);
    },
    setTempo() {},
    positionTicks: () => position,
    state: () => state,
    start() {
      if (state === 'stopped') state = 'started';
    },
    pause() {
      if (state === 'started') state = 'paused';
    },
    resume() {
      if (state === 'paused') state = 'started';
    },
    stop() {
      state = 'stopped';
      position = 0;
      bpm = null;
      entries = [];
    },
    setVolume() {},
    setMuted() {},
    playSfx(id) {
      log.push(`sfx ${id}`);
    },
    dispose() {
      entries = [];
    },
    diagnostics: () => ({
      scheduledEvents: entries.reduce((n, e) => n + e.plan.events.length + 1, 0),
      liveVoices: 0,
      instruments: 0,
      phrases: entries.length,
    }),
  };
  return {
    port,
    log,
    cancelled,
    tempoLog,
    entries: () => entries,
    /** Move the transport forward (only while started), firing commits and audible starts in order. */
    advanceTo(tick: number) {
      if (state !== 'started') return;
      while (true) {
        const due = entries
          .filter(
            (e) =>
              (!e.committed && e.handle.startTick - lookaheadTicks <= tick) ||
              (!e.audible && e.handle.startTick <= tick),
          )
          .sort((a, b) => a.handle.startTick - b.handle.startTick)[0];
        if (!due) break;
        if (!due.committed) {
          position = Math.max(position, due.handle.startTick - lookaheadTicks);
          due.committed = true;
          due.onCommit?.(due.plan);
          continue;
        }
        position = Math.max(position, due.handle.startTick);
        due.audible = true;
        // Port contract: the backend applies plan.bpm exactly at the phrase's start tick.
        if (due.plan.bpm !== bpm) {
          bpm = due.plan.bpm;
          tempoLog.push(`${bpm} @${due.handle.startTick}`);
        }
        due.onAudible(due.plan);
      }
      position = Math.max(position, tick);
      entries = entries.filter((e) => e.handle.endTick > position || !e.audible);
    },
    position: () => position,
  };
}
