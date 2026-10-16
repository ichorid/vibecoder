/**
 * The four bounded synth families built from validated presets. Presets are data with bounded
 * parameters; nothing here forwards arbitrary options from JSON to Tone constructors.
 */
import type * as ToneNamespace from 'tone';
import type { PresetDocument } from '../data/patterns.generated';
import type { PlannedEvent } from '../core/phrasePlanner';

type Tone = typeof ToneNamespace;

export interface Instrument {
  readonly presetId: string;
  trigger(event: PlannedEvent, time: number, duration: number): void;
  /** Immediately release every sounding or queued voice. */
  silence(time: number): void;
  dispose(): void;
  liveVoices(now: number): number;
}

const envelopeOf = (preset: PresetDocument) => ({
  attack: preset.envelope.attack,
  decay: preset.envelope.decay,
  sustain: preset.envelope.sustain,
  release: preset.envelope.release,
});

export function createInstrument(
  tone: Tone,
  preset: PresetDocument,
  output: ToneNamespace.InputNode,
  context: ToneNamespace.BaseContext,
): Instrument {
  const nodes: { dispose(): unknown }[] = [];
  const gain = new tone.Gain({ gain: preset.level, context });
  nodes.push(gain);
  let tail: ToneNamespace.ToneAudioNode = gain;
  if (preset.distortion !== undefined && preset.distortion > 0) {
    const distortion = new tone.Distortion({ distortion: preset.distortion, context });
    nodes.push(distortion);
    distortion.connect(tail);
    tail = distortion;
  }
  if (preset.filterHz !== undefined) {
    const filter = new tone.Filter({
      frequency: preset.filterHz,
      type: preset.family === 'noise' ? 'highpass' : 'lowpass',
      context,
    });
    nodes.push(filter);
    filter.connect(tail);
    tail = filter;
  }
  gain.connect(output);
  const ends: number[] = [];
  const track = (time: number, duration: number) => {
    ends.push(time + duration + preset.envelope.release);
    if (ends.length > 64) ends.splice(0, ends.length - 64);
  };
  const midiToFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

  if (preset.family === 'noise') {
    const kick = new tone.MembraneSynth({
      context,
      envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.05 },
    });
    const snare = new tone.NoiseSynth({
      context,
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.03 },
    });
    const hat = new tone.NoiseSynth({
      context,
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.01 },
    });
    const hatFilter = new tone.Filter({ frequency: 7000, type: 'highpass', context });
    hat.connect(hatFilter);
    hatFilter.connect(tail);
    kick.connect(tail);
    snare.connect(tail);
    nodes.push(kick, snare, hat, hatFilter);
    return {
      presetId: preset.id,
      trigger(event, time, duration) {
        track(time, duration);
        if (event.sound === 'kick')
          kick.triggerAttackRelease('C1', Math.min(duration, 0.3), time, event.velocity);
        else if (event.sound === 'snare')
          snare.triggerAttackRelease(Math.min(duration, 0.2), time, event.velocity);
        else if (event.sound === 'hat')
          hat.triggerAttackRelease(Math.min(duration, 0.06), time, event.velocity * 0.6);
      },
      silence(time) {
        kick.triggerRelease(time);
        snare.triggerRelease(time);
        hat.triggerRelease(time);
        ends.length = 0;
      },
      dispose() {
        for (const node of nodes) node.dispose();
      },
      liveVoices: (now) => ends.filter((end) => end > now).length,
    };
  }

  const oscillator =
    preset.family === 'triangle'
      ? ({ type: 'triangle' } as const)
      : ({ type: 'pulse', width: preset.pulseWidth ?? 0.5 } as const);
  const detune = preset.detuneCents ?? 0;
  let synth: ToneNamespace.Synth | ToneNamespace.FMSynth | ToneNamespace.PolySynth;
  if (preset.polyphony > 1 || preset.family === 'arp') {
    synth = new tone.PolySynth({
      voice: tone.Synth,
      context,
      maxPolyphony: preset.polyphony,
      options: { oscillator, envelope: envelopeOf(preset), detune },
    });
  } else if (preset.fm !== undefined && preset.fm > 0) {
    synth = new tone.FMSynth({
      context,
      modulationIndex: preset.fm,
      envelope: envelopeOf(preset),
      detune,
    });
  } else {
    synth = new tone.Synth({ context, oscillator, envelope: envelopeOf(preset), detune });
  }
  synth.connect(tail);
  nodes.push(synth);
  return {
    presetId: preset.id,
    trigger(event, time, duration) {
      if (event.midi === null) return;
      track(time, duration);
      synth.triggerAttackRelease(midiToFrequency(event.midi), duration, time, event.velocity);
    },
    silence(time) {
      if (synth instanceof tone.PolySynth) synth.releaseAll(time);
      else synth.triggerRelease(time);
      ends.length = 0;
    },
    dispose() {
      for (const node of nodes) node.dispose();
    },
    liveVoices: (now) => ends.filter((end) => end > now).length,
  };
}
