/**
 * Browser-only test fixture for real Tone rendering (served by the Vite dev server for
 * `npm run test:music-browser`; never part of the production build).
 */
import * as Tone from 'tone';
import type { PhrasePlan, PlannedEvent } from '../../../src/music/core/phrasePlanner';
import type { PresetDocument } from '../../../src/music/data/patterns.generated';
import { createToneBackend } from '../../../src/music/backend/toneBackend';
import { buildCatalog } from '../../../src/music/core/catalog';
import { createDirector } from '../../../src/music/director';
import { createLibrary } from '../../../src/music/library';
import { arrangement, era, pattern, sources } from '../fixtures';
import { EVOLUTION_TIMELINE, createTimelineDriver } from '../../../src/music/previewTimeline';
import { canonicalPayload } from '../../../src/music/core/canonical';
import { contentHash } from '../../../src/music/hash';

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

/**
 * A real director → Tone transition: Discovery (120 BPM) to Singularity (100 BPM), requested
 * mid-phrase. Probes the transport at fixed audio times; nothing may reset the clock.
 */
async function transition() {
  const { catalog } = buildCatalog(
    sources({
      eras: [
        era(),
        era({
          id: 'singularity',
          title: 'Singularity',
          defaults: {
            bpm: 100,
            bars: 4,
            stepsPerBar: 16,
            timeSignature: { numerator: 4, denominator: 4 },
          },
        }),
      ],
      arrangements: [arrangement()],
      patterns: [pattern({ id: 'disc-a' }), pattern({ id: 'sing-a', eraId: 'singularity' })],
    }),
  );
  const probes: { at: number; bpm: number; ticks: number }[] = [];
  const phrases: string[] = [];
  const buffer = await Tone.Offline(({ transport }) => {
    const backend = createToneBackend(Tone, { volume: 0.8 });
    const director = createDirector({
      backend,
      library: createLibrary(catalog, { candidates: 'all' }),
      seed: 1,
      onPhrase: (info) => phrases.push(`${info.key}@${info.startTick}`),
    });
    director.request({ era: 'discovery', arrangement: 'test-arrangement' });
    director.start();
    transport.scheduleOnce(
      () => director.request({ era: 'singularity', arrangement: 'test-arrangement' }),
      2,
    );
    // Probe on the audio clock (transport-time offsets would be converted at the old tempo).
    for (const at of [1, 7.9, 8.5, 12]) {
      Tone.getContext().setTimeout(
        () => probes.push({ at, bpm: transport.bpm.value, ticks: transport.ticks }),
        at,
      );
    }
  }, 12.5);
  return { probes, phrases, ...analyse(buffer) };
}

const repository = (folder: string): unknown[] =>
  Object.entries(import.meta.glob<unknown>('/music/**/*.json', { eager: true, import: 'default' }))
    .filter(([file]) => file.startsWith(`/music/${folder}/`))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);

/** The real demo catalog through the evolution timeline: per-phrase loudness and peak. */
async function evolution() {
  const { catalog, diagnostics } = buildCatalog({
    eras: repository('eras'),
    presets: repository('presets'),
    arrangements: repository('arrangements'),
    motifs: repository('motif'),
    patterns: repository('patterns'),
  });
  const commits: string[] = [];
  const buffer = await Tone.Offline(() => {
    const backend = createToneBackend(Tone, { volume: 1 });
    const driver = createTimelineDriver(EVOLUTION_TIMELINE);
    const director = createDirector({
      backend,
      library: createLibrary(catalog, { candidates: 'demo', demoFallback: true }),
      seed: 4,
      onCommit: (info) => {
        commits.push(`${info.eraId}<${info.sourceEraId}:${info.status}`);
        driver.onCommit(info);
      },
    });
    driver.attach(director);
    director.start();
  }, 100);
  const { windows, peak } = analyse(buffer);
  // 50 ms windows → 8 s phrases of 160 windows each.
  const phraseRms = Array.from({ length: 12 }, (_, i) => {
    const slice = windows.slice(i * 160, (i + 1) * 160);
    return Math.sqrt(slice.reduce((sum, v) => sum + v * v, 0) / slice.length);
  });
  // Silence after the last phrase once a bounded release (≤ 1.5 s) has decayed.
  const tail = Math.max(...windows.slice(Math.round(97.5 / 0.05)));
  return {
    errors: diagnostics.filter((d) => d.level === 'error').length,
    commits,
    phraseRms,
    tail,
    peak,
  };
}

/** Browser Web Crypto hash of a repository demo pattern, with the exact canonical bytes. */
async function hashParity() {
  const { catalog } = buildCatalog({
    eras: repository('eras'),
    presets: repository('presets'),
    arrangements: repository('arrangements'),
    motifs: repository('motif'),
    patterns: repository('patterns'),
  });
  const target = catalog.patterns.find((p) => p.id === 'singularity-demo-b');
  if (!target) throw new Error('demo pattern missing');
  return { canonical: canonicalPayload(target, catalog), hash: await contentHash(target, catalog) };
}

/** Care sound effects over the loudest demo phrase: audible, never clipping. */
async function sfxMix() {
  const { catalog } = buildCatalog({
    eras: repository('eras'),
    presets: repository('presets'),
    arrangements: repository('arrangements'),
    motifs: repository('motif'),
    patterns: repository('patterns'),
  });
  const buffer = await Tone.Offline(({ transport }) => {
    const backend = createToneBackend(Tone, { volume: 1 });
    const director = createDirector({
      backend,
      library: createLibrary(catalog, { candidates: 'demo' }),
      seed: 2,
    });
    director.request({
      era: 'discovery',
      arrangement: 'discovery-support',
      pin: 'discovery-demo-b@1',
    });
    director.start();
    for (const [at, id] of [
      [1, 'feed'],
      [2.5, 'pet'],
      [4, 'play'],
    ] as const) {
      transport.scheduleOnce(() => director.playSfx(id), at);
    }
  }, 5);
  return analyse(buffer);
}

(window as unknown as { musicFixture: unknown }).musicFixture = {
  render,
  lifecycleCycles,
  transition,
  evolution,
  hashParity,
  sfxMix,
};
