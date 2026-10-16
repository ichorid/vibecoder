import { describe, expect, it } from 'vitest';
import { createAudioPreferences, type PreferenceStorage } from '../../src/music/preferences';
import { createLabController, type LabState } from '../../src/music-lab/labController';
import { readRepository } from '../../tools/music/sources';
import { pattern } from './fixtures';
import { createFakeBackend } from './helpers/fakeBackend';

const PHRASE = 3072;

function memory(): PreferenceStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function setup(extraPatterns: unknown[] = []) {
  const fake = createFakeBackend();
  let loads = 0;
  let state: LabState | null = null;
  const repo = readRepository('music');
  const storage = memory();
  const lab = createLabController({
    sources: { ...repo, patterns: [...repo.patterns, ...extraPatterns] },
    seed: 9,
    preferences: createAudioPreferences(storage),
    load: () => {
      loads += 1;
      return Promise.resolve({ backend: fake.port, unlock: () => Promise.resolve() });
    },
    onState: (s) => (state = s),
  });
  return {
    fake,
    lab,
    storage,
    loads: () => loads,
    state: () => {
      if (!state) throw new Error('no state published');
      return state;
    },
  };
}

describe('music lab controller', () => {
  it('starts with no engine and loads exactly one on the first play', async () => {
    const t = setup();
    expect(t.loads()).toBe(0);
    expect(t.state().status).toBe('idle');
    t.lab.select('discovery-demo-a@1');
    await t.lab.play();
    await t.lab.play();
    t.lab.setMode('evolution');
    await t.lab.play();
    expect(t.loads()).toBe(1);
    expect(t.state().status).toBe('playing');
  });

  it('Single loops the selected version and shows it only once audible', async () => {
    const t = setup();
    t.lab.select('singularity-demo-b@1');
    await t.lab.play();
    expect(t.state().now).toBeNull();
    t.fake.advanceTo(0);
    expect(t.state().now?.key).toBe('singularity-demo-b@1');
    t.fake.advanceTo(PHRASE - 10);
    t.lab.select('discovery-demo-a@1');
    expect(t.state().single.selected).toBe('discovery-demo-a@1');
    expect(t.state().now?.key).toBe('singularity-demo-b@1');
    t.fake.advanceTo(PHRASE);
    expect(t.state().now?.key).toBe('singularity-demo-b@1'); // the next phrase was already committed
    t.fake.advanceTo(2 * PHRASE);
    expect(t.state().now?.key).toBe('discovery-demo-a@1');
  });

  it('a hard-invalid version shows diagnostics and cannot play', async () => {
    const bad = pattern({
      id: 'too-high',
      tracks: { lead: [{ type: 'note', step: 0, length: 4, pitch: 'C8' }] },
    });
    const t = setup([bad]);
    const entry = t.state().entries.find((e) => e.key === 'too-high@1');
    expect(entry?.playable).toBe(false);
    expect(entry?.errors.join(' ')).toMatch(/range/);
    t.lab.select('too-high@1');
    await t.lab.play();
    expect(t.loads()).toBe(0);
    expect(t.state().message).toMatch(/cannot play/i);
  });

  it('marks a tempo override as audition-only', async () => {
    const t = setup();
    t.lab.select('discovery-demo-a@1');
    t.lab.setTempoOverride(90);
    await t.lab.play();
    t.fake.advanceTo(0);
    expect(t.fake.tempoLog).toEqual(['90 @0']);
    expect(t.state().single.tempoOverride).toBe(90);
  });

  it('Random is approved-only by default and honestly empty before reviews', async () => {
    const t = setup();
    t.lab.setMode('random');
    expect(t.state().random).toMatchObject({ includeDemo: false, candidates: 0 });
    await t.lab.play();
    expect(t.loads()).toBe(0);
    expect(t.state().message).toMatch(/no approved/i);
  });

  it('Random with the explicit demo toggle plays five minutes without repeats or NEXT', async () => {
    const t = setup();
    t.lab.setMode('random');
    t.lab.setRandom({ era: 'discovery', includeDemo: true });
    expect(t.state().random.candidates).toBe(2);
    expect(t.state().demoPlayback).toBe(true);
    const keys: string[] = [];
    await t.lab.play();
    for (let i = 0; i < 38; i += 1) {
      t.fake.advanceTo(i * PHRASE);
      keys.push(t.state().now?.key ?? '');
    }
    expect(new Set(keys)).toEqual(new Set(['discovery-demo-a@1', 'discovery-demo-b@1']));
    for (let i = 1; i < keys.length; i += 1) expect(keys[i]).not.toBe(keys[i - 1]);
    t.lab.setRandom({ era: 'singularity', includeDemo: true });
    t.fake.advanceTo(38 * PHRASE);
    t.fake.advanceTo(39 * PHRASE);
    expect(t.state().now?.eraId).toBe('singularity');
  });

  it('Transition alternates A→B across eras and warns about a doubtful pair', async () => {
    const t = setup();
    t.lab.setMode('transition');
    t.lab.setTransition('discovery-demo-a@1', 'singularity-demo-a@1');
    expect(t.state().transition.warning).toBeNull();
    await t.lab.play();
    const heard: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      t.fake.advanceTo(i * PHRASE);
      heard.push(t.state().now?.key ?? '');
    }
    expect(heard).toEqual([
      'discovery-demo-a@1',
      'singularity-demo-a@1',
      'discovery-demo-a@1',
      'singularity-demo-a@1',
    ]);
    // discovery-demo-b ends on the tonic, demo-a ends on the dominant: a → a is allowed, but a
    // pattern that enters on the dominant is not.
    const odd = pattern({
      id: 'odd-entry',
      boundary: { entryGroup: 'dominant', exitGroup: 'tonic' },
    });
    const u = setup([odd]);
    u.lab.setMode('transition');
    u.lab.setTransition('discovery-demo-a@1', 'odd-entry@1');
    expect(u.state().transition.warning).toMatch(/audition only/i);
  });

  it('Evolution runs six eras with labelled fallbacks, then stops; switching modes clears it', async () => {
    const t = setup();
    t.lab.setMode('evolution');
    expect(t.state().evolution.durationSeconds).toBeCloseTo(96, 6);
    await t.lab.play();
    const seen: string[] = [];
    for (let i = 0; i <= 12; i += 1) {
      t.fake.advanceTo(i * PHRASE);
      const now = t.state().now;
      if (now) seen.push(`${now.eraId}<${now.sourceEraId}`);
    }
    expect(new Set(seen)).toEqual(
      new Set([
        'discovery<discovery',
        'acceleration<discovery',
        'orchestration<discovery',
        'recursion<singularity',
        'self-improvement<singularity',
        'singularity<singularity',
      ]),
    );
    expect(t.state().status).toBe('idle');
    expect(t.fake.entries()).toHaveLength(0);

    await t.lab.play();
    t.fake.advanceTo(13 * PHRASE);
    t.lab.setMode('single');
    expect(t.fake.entries()).toHaveLength(0);
    expect(t.state().status).toBe('idle');
  });

  it('volume persists in the shared audio preferences and mode switches keep it', () => {
    const t = setup();
    t.lab.setVolume(0.6);
    t.lab.setMode('evolution');
    t.lab.setMode('single');
    expect(t.state().volume).toBe(0.6);
    expect(JSON.parse(t.storage.data.get('vibecoder.audio.v1') ?? '{}')).toMatchObject({
      volume: 0.6,
    });
  });
});
