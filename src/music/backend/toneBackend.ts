/**
 * The only module that drives Tone. One owned Transport per document: phrases are scheduled at
 * absolute ticks (`'<n>i'`), callbacks use the audio time Tone passes in, the UI hears about a
 * phrase through Draw at its audible start. Pause keeps the musical position but disposes the
 * voice bank so no queued note can sound later; resume re-attacks notes still in progress.
 */
import type * as ToneNamespace from 'tone';
import type { PresetDocument } from '../data/patterns.generated';
import type { PhrasePlan, PlannedEvent } from '../core/phrasePlanner';
import { createInstrument, type Instrument } from './instruments';
import type { BackendDiagnostics, MusicBackendPort, PhraseHandle, SfxId } from './port';

type Tone = typeof ToneNamespace;

export interface ToneBackendOptions {
  readonly ppq?: number;
  readonly volume?: number;
}

interface PhraseRecord {
  readonly handle: PhraseHandle;
  readonly plan: PhrasePlan;
  readonly ids: number[];
  committed: boolean;
}

/** Short gain ramps avoid clicks when silencing or restoring. */
const RAMP_S = 0.02;

export function createToneBackend(tone: Tone, options: ToneBackendOptions = {}): MusicBackendPort {
  const ppq = options.ppq ?? 192;
  // Capture this backend's context: callbacks may run when Tone's global context differs.
  const context = tone.getContext();
  const transport = context.transport;
  const draw = context.draw;
  transport.PPQ = ppq;

  const limiter = new tone.Limiter({ threshold: -1, context }).connect(context.destination);
  const master = new tone.Gain({ gain: options.volume ?? 0.35, context }).connect(limiter);
  // Fixed headroom: the loudest legal arrangement (8 voices at full velocity) stays below 0 dBFS
  // at maximum volume; the limiter is only insurance.
  const musicBus = new tone.Gain({ gain: 0.28, context }).connect(master);
  const sfxBus = new tone.Gain({ gain: 0.6, context }).connect(master);
  let volume = options.volume ?? 0.35;
  let muted = false;
  let disposed = false;
  let sfxSynth: ToneNamespace.Synth | null = null;

  const presets = new Map<string, PresetDocument>();
  const instruments = new Map<string, Instrument>();
  const records = new Map<number, PhraseRecord>();
  let nextId = 1;

  const audibleGain = () => (muted ? 0 : volume);
  /** Apply the current level: instantly while silent/stopped, with a short ramp while playing. */
  function applyLevel(): void {
    if (transport.state === 'started') master.gain.rampTo(audibleGain(), RAMP_S);
    else if (transport.state === 'stopped') master.gain.value = audibleGain();
  }
  const secondsForTicks = (ticks: number) => (ticks / ppq) * (60 / transport.bpm.value);
  const audioNow = () => context.currentTime + context.lookAhead;

  function instrument(presetId: string): Instrument | null {
    const existing = instruments.get(presetId);
    if (existing) return existing;
    const preset = presets.get(presetId);
    if (!preset) return null;
    const created = createInstrument(tone, preset, musicBus, context);
    instruments.set(presetId, created);
    return created;
  }

  function play(event: PlannedEvent, time: number, ticks: number): void {
    // A zero-velocity event never creates a voice.
    if (event.velocity <= 0) return;
    instrument(event.presetId)?.trigger(event, time, Math.max(0.01, secondsForTicks(ticks)));
  }

  function prune(): void {
    const position = transport.ticks;
    for (const [id, record] of records) {
      if (record.plan.endTick <= position && record.committed) records.delete(id);
    }
  }

  function disposeVoices(time: number): void {
    for (const voice of instruments.values()) {
      voice.silence(time);
      voice.dispose();
    }
    instruments.clear();
  }

  return {
    ppq,
    loadPresets(list) {
      for (const preset of list) presets.set(preset.id, preset);
    },
    schedulePhrase(plan, onAudible) {
      prune();
      const handle: PhraseHandle = {
        id: nextId,
        key: plan.key,
        startTick: plan.startTick,
        endTick: plan.endTick,
      };
      nextId += 1;
      const record: PhraseRecord = { handle, plan, ids: [], committed: false };
      record.ids.push(
        transport.schedule((time) => {
          record.committed = true;
          draw.schedule(() => onAudible(plan), time);
        }, `${plan.startTick}i`),
      );
      for (const event of plan.events) {
        record.ids.push(
          transport.schedule(
            (time) => play(event, time, event.endTick - event.startTick),
            `${event.startTick}i`,
          ),
        );
      }
      records.set(handle.id, record);
      return handle;
    },
    isCommitted: (handle) => records.get(handle.id)?.committed ?? true,
    cancelPhrase(handle) {
      const record = records.get(handle.id);
      if (!record) return;
      for (const id of record.ids) transport.clear(id);
      records.delete(handle.id);
    },
    setTempo(bpm) {
      transport.bpm.value = bpm;
    },
    positionTicks: () => transport.ticks,
    state: () => transport.state,
    start() {
      if (disposed || transport.state === 'started') return;
      master.gain.value = audibleGain();
      transport.start();
    },
    pause() {
      if (transport.state !== 'started') return;
      const now = audioNow();
      master.gain.cancelScheduledValues(now);
      master.gain.rampTo(0, RAMP_S, now);
      transport.pause(now);
      // Disposing the bank guarantees that notes already handed to the audio thread stop.
      disposeVoices(now + RAMP_S);
    },
    resume() {
      if (disposed || transport.state !== 'paused') return;
      const position = transport.ticks;
      const now = audioNow();
      transport.start(now);
      master.gain.rampTo(audibleGain(), RAMP_S * 1.5, now);
      // Re-attack notes still in progress at the paused position, for their remaining length.
      for (const record of records.values()) {
        for (const event of record.plan.events) {
          if (event.startTick < position && event.endTick > position && event.type === 'note') {
            play(event, now + 0.01, event.endTick - position);
          }
        }
      }
    },
    stop() {
      const now = audioNow();
      transport.stop(now);
      transport.cancel(0);
      transport.ticks = 0;
      records.clear();
      disposeVoices(now);
    },
    setVolume(next) {
      volume = Math.min(1, Math.max(0, next));
      applyLevel();
    },
    setMuted(next) {
      muted = next;
      applyLevel();
    },
    playSfx(id: SfxId) {
      if (disposed) return;
      sfxSynth ??= new tone.Synth({
        context,
        oscillator: { type: 'square' },
        envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.04 },
      }).connect(sfxBus);
      const now = audioNow();
      const notes: Record<SfxId, [string, string]> = {
        feed: ['C6', 'E6'],
        pet: ['G5', 'B5'],
        play: ['E6', 'A6'],
      };
      const [first, second] = notes[id];
      sfxSynth.triggerAttackRelease(first, 0.05, now, 0.5);
      sfxSynth.triggerAttackRelease(second, 0.07, now + 0.07, 0.5);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const now = audioNow();
      transport.stop(now);
      transport.cancel(0);
      records.clear();
      disposeVoices(now);
      sfxSynth?.dispose();
      for (const node of [sfxBus, musicBus, master, limiter]) node.dispose();
    },
    diagnostics(): BackendDiagnostics {
      const now = audioNow();
      let scheduledEvents = 0;
      for (const record of records.values()) scheduledEvents += record.ids.length;
      let liveVoices = 0;
      for (const voice of instruments.values()) liveVoices += voice.liveVoices(now);
      return { scheduledEvents, liveVoices, instruments: instruments.size, phrases: records.size };
    },
  };
}
