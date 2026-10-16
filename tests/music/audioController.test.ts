import { describe, expect, it } from 'vitest';
import {
  createAudioController,
  type AudioLoader,
  type AudioState,
  type MusicEngine,
} from '../../src/music/public';
import { AUDIO_PREFS_KEY, createAudioPreferences } from '../../src/music/preferences';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

function fakeEngine() {
  const calls: string[] = [];
  const engine: MusicEngine = {
    start: () => calls.push('start'),
    pause: () => calls.push('pause'),
    resume: () => calls.push('resume'),
    setVolume: (v) => calls.push(`volume ${v}`),
    setMuted: (m) => calls.push(`muted ${m}`),
    dispose: () => calls.push('dispose'),
  };
  return { engine, calls };
}

/** A fake audio context state the OS can change (screen lock, call, other app). */
function fakeContext() {
  let state = 'running';
  const listeners = new Set<() => void>();
  return {
    state: () => state,
    onChange: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next: string) {
      state = next;
      for (const l of listeners) l();
    },
  };
}

function setup(
  options: {
    unlock?: () => Promise<void>;
    delay?: boolean;
    active?: () => boolean;
    context?: ReturnType<typeof fakeContext>;
  } = {},
) {
  const storage = memoryStorage();
  const prefs = createAudioPreferences(storage);
  const fake = fakeEngine();
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const loader: AudioLoader = async () => {
    if (options.delay) await gate;
    const context = options.context;
    return {
      unlock: options.unlock ?? (() => Promise.resolve()),
      engine: fake.engine,
      ...(context ? { contextState: context.state, onContextChange: context.onChange } : {}),
    };
  };
  const states: AudioState[] = [];
  const controller = createAudioController({
    loader,
    preferences: prefs,
    userActivationActive: options.active ?? (() => true),
    onState: (s) => states.push(s),
  });
  return { controller, storage, fake, states, release, last: () => states.at(-1) };
}

describe('audio controller', () => {
  it('starts nothing before the player turns sound on', () => {
    const t = setup();
    expect(t.last()?.status ?? t.controller.state().status).toBe('off');
    expect(t.fake.calls).toEqual([]);
  });

  it('plays after a gesture and persists the choice, not the unlock', async () => {
    const t = setup();
    await t.controller.setSound(true);
    expect(t.controller.state().status).toBe('playing');
    expect(t.fake.calls).toContain('start');
    expect(JSON.parse(t.storage.getItem(AUDIO_PREFS_KEY) ?? '{}')).toEqual({
      schemaVersion: 1,
      soundOn: true,
      volume: 0.35,
    });
  });

  it('reports needsGesture without an unhandled rejection when the browser refuses', async () => {
    const t = setup({ unlock: () => Promise.reject(new Error('not allowed')) });
    await expect(t.controller.setSound(true)).resolves.toBeUndefined();
    expect(t.controller.state().status).toBe('needsGesture');
  });

  it('asks for another tap when a slow load outlived the gesture, then plays on that tap', async () => {
    let active = true;
    const t = setup({ delay: true, active: () => active });
    const pending = t.controller.setSound(true);
    expect(t.controller.state().status).toBe('loading');
    active = false;
    t.release();
    await pending;
    expect(t.controller.state().status).toBe('needsGesture');
    active = true;
    await t.controller.setSound(true);
    expect(t.controller.state().status).toBe('playing');
  });

  it('mutes by pausing scheduling and remembers volume', async () => {
    const t = setup();
    await t.controller.setSound(true);
    t.controller.setVolume(0.6);
    await t.controller.setSound(false);
    expect(t.fake.calls).toContain('pause');
    expect(t.controller.state().status).toBe('off');
    const saved = JSON.parse(t.storage.getItem(AUDIO_PREFS_KEY) ?? '{}') as {
      volume: number;
      soundOn: boolean;
    };
    expect(saved).toMatchObject({ volume: 0.6, soundOn: false });
    await t.controller.setSound(true);
    expect(t.fake.calls.filter((c) => c === 'resume')).toHaveLength(1);
  });

  it('falls back to defaults on corrupt preferences and never touches the game save', () => {
    const storage = memoryStorage({
      [AUDIO_PREFS_KEY]: '{"volume":"loud"',
      'vibe-coder.save': 'GAME',
    });
    const prefs = createAudioPreferences(storage);
    expect(prefs.load()).toEqual({ schemaVersion: 1, soundOn: false, volume: 0.35 });
    prefs.save({ schemaVersion: 1, soundOn: true, volume: 0.5 });
    expect(storage.getItem('vibe-coder.save')).toBe('GAME');
  });

  it('is unavailable (not broken) when the audio module cannot load', async () => {
    const storage = memoryStorage();
    const controller = createAudioController({
      loader: () => Promise.reject(new Error('offline')),
      preferences: createAudioPreferences(storage),
      userActivationActive: () => true,
      onState: () => {},
    });
    await controller.setSound(true);
    expect(controller.state().status).toBe('unavailable');
  });

  it('an interrupted audio context asks for a tap; the tap resumes without a second player', async () => {
    const context = fakeContext();
    const t = setup({ context });
    await t.controller.setSound(true);
    expect(t.last()?.status).toBe('playing');
    context.set('interrupted');
    expect(t.last()).toMatchObject({ status: 'needsGesture', soundOn: true });
    expect(t.last()?.message).toMatch(/tap/i);
    context.set('suspended');
    const resume = t.controller.setSound(true);
    context.set('running');
    await resume;
    expect(t.last()?.status).toBe('playing');
    expect(t.fake.calls.filter((c) => c === 'start')).toHaveLength(1);
  });

  it('waking with a context the browser kept suspended asks for a tap instead of claiming sound', async () => {
    const context = fakeContext();
    const t = setup({ context });
    await t.controller.setSound(true);
    t.controller.suspend();
    context.set('suspended');
    t.controller.wake();
    expect(t.last()?.status).toBe('needsGesture');
  });

  it('a load that finishes after dispose never revives audio', async () => {
    const t = setup({ delay: true });
    const pending = t.controller.setSound(true);
    t.controller.dispose();
    t.release();
    await pending;
    expect(t.fake.calls).toContain('dispose');
    expect(t.fake.calls).not.toContain('start');
  });
});
