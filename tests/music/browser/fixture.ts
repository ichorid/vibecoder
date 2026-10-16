/**
 * Browser-only test fixture for real Tone rendering (served by the Vite dev server for
 * `npm run test:music-browser`; never part of the production build).
 */
import * as Tone from 'tone';
import type { PhrasePlan, PlannedEvent } from '../../../src/music/core/phrasePlanner';
import type { PresetDocument } from '../../../src/music/data/patterns.generated';
import { createToneBackend } from '../../../src/music/backend/toneBackend';

export interface RenderSpec {
  seconds: number;
  presets: PresetDocument[];
  phrases: { startTick: number; endTick: number; events: PlannedEvent[] }[];
  muted?: boolean;
  pauseAt?: number;
  resumeAt?: number;
  stopAt?: number;
  volume?: number;
}

function analyse(buffer: Tone.ToneAudioBuffer) {
  const data = buffer.getChannelData(0);
  const size = Math.round(buffer.sampleRate * 0.05);
  const windows: number[] = [];
  let peak = 0;
  for (let start = 0; start < data.length; start += size) {
    let sum = 0;
    const end = Math.min(data.length, start + size);
    for (let i = start; i < end; i += 1) {
      const v = data[i] ?? 0;
      sum += v * v;
      peak = Math.max(peak, Math.abs(v));
    }
    windows.push(Math.sqrt(sum / Math.max(1, end - start)));
  }
  return { windows, peak };
}

async function render(spec: RenderSpec) {
  let diagnostics: unknown = null;
  const buffer = await Tone.Offline(({ transport }) => {
    const backend = createToneBackend(Tone, { volume: spec.volume ?? 0.8 });
    backend.loadPresets(spec.presets);
    if (spec.muted) backend.setMuted(true);
    spec.phrases.forEach((phrase, i) => {
      const plan: PhrasePlan = {
        key: `fixture-${i}@1`,
        patternId: `fixture-${i}`,
        revision: 1,
        eraId: 'test',
        arrangementId: 'test',
        bpm: 120,
        startTick: phrase.startTick,
        endTick: phrase.endTick,
        events: phrase.events,
        dropped: 0,
      };
      backend.schedulePhrase(plan, () => {});
    });
    backend.start();
    if (spec.pauseAt !== undefined) transport.scheduleOnce(() => backend.pause(), spec.pauseAt);
    if (spec.resumeAt !== undefined) {
      // A paused transport fires nothing, so resume from the context clock.
      Tone.getContext().setTimeout(() => backend.resume(), spec.resumeAt);
    }
    if (spec.stopAt !== undefined) transport.scheduleOnce(() => backend.stop(), spec.stopAt);
    diagnostics = backend.diagnostics();
  }, spec.seconds);
  return { ...analyse(buffer), diagnostics };
}

async function lifecycleCycles(count: number) {
  let result: unknown = null;
  await Tone.Offline(() => {
    const backend = createToneBackend(Tone);
    backend.loadPresets([]);
    for (let i = 0; i < count; i += 1) {
      backend.schedulePhrase(
        {
          key: 'x@1',
          patternId: 'x',
          revision: 1,
          eraId: 't',
          arrangementId: 't',
          bpm: 120,
          startTick: 0,
          endTick: 3072,
          events: [],
          dropped: 0,
        },
        () => {},
      );
      backend.start();
      backend.pause();
      backend.resume();
      backend.stop();
    }
    result = backend.diagnostics();
    backend.dispose();
    backend.dispose();
  }, 0.1);
  return result;
}

(window as unknown as { musicFixture: unknown }).musicFixture = { render, lifecycleCycles };
