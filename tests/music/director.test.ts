import { describe, expect, it } from 'vitest';
import { createDirector } from '../../src/music/director';
import { createLibrary } from '../../src/music/library';
import { buildCatalog } from '../../src/music/core/catalog';
import { createFakeBackend } from './helpers/fakeBackend';
import { arrangement, era, pattern, sources } from './fixtures';

const PHRASE = 3072;

function library(extra: { patterns?: unknown[]; eras?: unknown[]; arrangements?: unknown[] } = {}) {
  const input = sources({
    eras: [
      era(),
      era({ id: 'singularity', title: 'Singularity', defaultArrangement: 'test-arrangement' }),
      ...(extra.eras ?? []),
    ],
    arrangements: [arrangement(), arrangement({ id: 'denser' }), ...(extra.arrangements ?? [])],
    patterns: extra.patterns ?? [
      pattern({ id: 'disc-a' }),
      pattern({ id: 'disc-b' }),
      pattern({ id: 'sing-a', eraId: 'singularity' }),
      pattern({ id: 'sing-b', eraId: 'singularity' }),
    ],
  });
  const { catalog, diagnostics } = buildCatalog(input);
  expect(diagnostics.filter((d) => d.level === 'error')).toEqual([]);
  return createLibrary(catalog, { candidates: 'all' });
}

function setup(lib = library()) {
  const fake = createFakeBackend();
  const heard: { key: string; era: string; arrangement: string }[] = [];
  const director = createDirector({
    backend: fake.port,
    library: lib,
    seed: 11,
    onPhrase: (info) =>
      heard.push({ key: info.key, era: info.eraId, arrangement: info.arrangementId }),
  });
  director.request({ era: 'discovery', arrangement: 'test-arrangement' });
  return { fake, director, heard };
}

describe('music director', () => {
  it('starts once; a second start never duplicates the player', () => {
    const t = setup();
    t.director.start();
    t.director.start();
    expect(t.fake.log.filter((l) => l.startsWith('schedule'))).toHaveLength(1);
    t.fake.advanceTo(0);
    expect(t.fake.log.filter((l) => l.startsWith('schedule'))).toHaveLength(2);
  });

  it('keeps one phrase ahead at exact boundaries', () => {
    const t = setup();
    t.director.start();
    for (let i = 0; i < 10; i += 1) t.fake.advanceTo(i * PHRASE);
    expect(t.fake.entries().length).toBeLessThanOrEqual(2);
    expect(t.heard).toHaveLength(10);
    expect(t.fake.log.at(-1)).toMatch(new RegExp(`@${10 * PHRASE}$`));
  });

  it('finishes the current phrase before an era change (request before commit)', () => {
    const t = setup();
    t.director.start();
    t.fake.advanceTo(100);
    t.director.request({ era: 'singularity', arrangement: 'test-arrangement' });
    expect(t.fake.cancelled).toHaveLength(1);
    t.fake.advanceTo(PHRASE);
    expect(t.heard.map((h) => h.era)).toEqual(['discovery', 'singularity']);
  });

  it('postpones a request that arrives after the next phrase committed', () => {
    const t = setup();
    t.director.start();
    t.fake.advanceTo(PHRASE - 10);
    t.director.request({ era: 'singularity', arrangement: 'test-arrangement' });
    // The committed phrase at PHRASE stays; only the uncommitted one after it is replaced.
    expect(t.fake.cancelled.every((c) => c.endsWith(`@${2 * PHRASE}`))).toBe(true);
    t.fake.advanceTo(2 * PHRASE);
    expect(t.heard.map((h) => h.era)).toEqual(['discovery', 'discovery', 'singularity']);
  });

  it('changes the arrangement without changing the era, never mixing two in one phrase', () => {
    const t = setup();
    t.director.start();
    t.fake.advanceTo(10);
    t.director.request({ era: 'discovery', arrangement: 'denser' });
    t.fake.advanceTo(PHRASE);
    expect(t.heard.at(-1)).toMatchObject({ era: 'discovery', arrangement: 'denser' });
    for (const entry of t.fake.entries()) expect(new Set([entry.plan.arrangementId]).size).toBe(1);
  });

  it('collapses rapid requests to the latest one', () => {
    const t = setup();
    t.director.start();
    t.fake.advanceTo(10);
    t.director.request({ era: 'singularity', arrangement: 'test-arrangement' });
    t.director.request({ era: 'discovery', arrangement: 'denser' });
    t.director.request({ era: 'singularity', arrangement: 'denser' });
    t.fake.advanceTo(PHRASE);
    expect(t.heard.at(-1)).toMatchObject({ era: 'singularity', arrangement: 'denser' });
    expect(t.fake.entries().filter((e) => !e.audible)).toHaveLength(1);
  });

  it('updates the desired state while paused without moving the clock', () => {
    const t = setup();
    t.director.start();
    t.fake.advanceTo(200);
    t.director.pause();
    t.director.request({ era: 'singularity', arrangement: 'test-arrangement' });
    t.fake.advanceTo(10 * PHRASE);
    expect(t.fake.position()).toBe(200);
    expect(t.director.snapshot().requested.era).toBe('singularity');
    t.director.resume();
    t.fake.advanceTo(PHRASE);
    expect(t.heard.at(-1)?.era).toBe('singularity');
  });

  it('keeps the current bank or falls silent when the requested bank is empty, never inventing material', () => {
    const lib = library({ patterns: [pattern({ id: 'disc-a' })] });
    const t = setup(lib);
    t.director.start();
    t.fake.advanceTo(10);
    t.director.request({ era: 'singularity', arrangement: 'test-arrangement' });
    t.fake.advanceTo(PHRASE);
    expect(t.heard.at(-1)).toMatchObject({ era: 'discovery' });
    expect(t.director.snapshot().status).toBe('fallback');
  });

  it('stop resets the clock and selection; restart begins again at zero', () => {
    const t = setup();
    t.director.start();
    t.fake.advanceTo(2 * PHRASE);
    t.director.stop();
    expect(t.fake.position()).toBe(0);
    t.director.start();
    expect(t.fake.log.at(-1)).toMatch(/@0$/);
  });

  it('falls silent under the silence policy and keeps the clock running', () => {
    const lib = library({
      patterns: [pattern({ id: 'disc-a' })],
      eras: [era({ id: 'quiet', title: 'Quiet', emptyBankPolicy: 'silence' })],
    });
    const t = setup(lib);
    t.director.start();
    t.fake.advanceTo(10);
    t.director.request({ era: 'quiet', arrangement: 'test-arrangement' });
    t.fake.advanceTo(PHRASE);
    expect(t.heard.at(-1)?.key).toBe('silence@0');
    expect(t.director.snapshot().status).toBe('silent');
    expect(t.fake.log.at(-1)).toMatch(new RegExp(`@${2 * PHRASE}$`));
  });

  it('labels a Lab demo fallback with the true source era', () => {
    const input = sources({
      eras: [
        era(),
        era({ id: 'acceleration', title: 'Acceleration', demoFallbackEra: 'discovery' }),
      ],
      arrangements: [arrangement()],
      patterns: [pattern({ id: 'disc-a', demo: true })],
    });
    const lib = createLibrary(buildCatalog(input).catalog, {
      candidates: 'demo',
      demoFallback: true,
    });
    const fake = createFakeBackend();
    const infos: { eraId: string; sourceEraId: string; status: string }[] = [];
    const director = createDirector({
      backend: fake.port,
      library: lib,
      seed: 3,
      onPhrase: (i) => infos.push(i),
    });
    director.request({ era: 'acceleration', arrangement: 'test-arrangement' });
    director.start();
    fake.advanceTo(0);
    expect(infos[0]).toMatchObject({
      eraId: 'acceleration',
      sourceEraId: 'discovery',
      status: 'demo-fallback',
    });
  });

  it('a pinned version loops on every boundary', () => {
    const t = setup();
    t.director.request({ era: 'discovery', arrangement: 'test-arrangement', pin: 'disc-b@1' });
    t.director.start();
    for (let i = 0; i < 4; i += 1) t.fake.advanceTo(i * PHRASE);
    expect(new Set(t.heard.map((h) => h.key))).toEqual(new Set(['disc-b@1']));
  });
});

describe('music director: one engine for every Lab mode', () => {
  it('swaps the library on the next boundary without a second player', () => {
    const t = setup();
    t.director.start();
    t.fake.advanceTo(10);
    const only = library({ patterns: [pattern({ id: 'only-one' })] });
    t.director.setLibrary(only);
    t.fake.advanceTo(PHRASE);
    t.fake.advanceTo(2 * PHRASE);
    expect(t.heard.slice(1).map((h) => h.key)).toEqual(['only-one@1', 'only-one@1']);
    expect(t.fake.entries().length).toBeLessThanOrEqual(2);
  });

  it('an audition tempo override changes only the planned BPM, and is reported', () => {
    const t = setup();
    t.director.request({
      era: 'discovery',
      arrangement: 'test-arrangement',
      pin: 'disc-a@1',
      tempoOverride: 90,
    });
    t.director.start();
    t.fake.advanceTo(0);
    expect(t.fake.tempoLog).toEqual(['90 @0']);
    expect(t.director.snapshot().requested.tempoOverride).toBe(90);
    t.director.request({ era: 'discovery', arrangement: 'test-arrangement', pin: 'disc-a@1' });
    t.fake.advanceTo(PHRASE);
    expect(t.fake.tempoLog).toEqual(['90 @0', `120 @${PHRASE}`]);
  });
});

describe('music director: game lifecycle', () => {
  it('end() lets the current phrase finish and schedules nothing after it', () => {
    const t = setup();
    t.director.start();
    t.fake.advanceTo(10);
    t.director.end();
    // The uncommitted next phrase is withdrawn.
    expect(t.fake.cancelled).toHaveLength(1);
    expect(t.fake.cancelled[0]).toMatch(new RegExp(`@${PHRASE}$`));
    for (let i = 1; i <= 3; i += 1) t.fake.advanceTo(i * PHRASE);
    expect(t.heard).toHaveLength(1);
    expect(t.fake.entries().filter((e) => !e.audible)).toHaveLength(0);
    expect(t.director.snapshot().status).toBe('ended');
  });

  it('end() after the next phrase committed finishes that one too, then stops', () => {
    const t = setup();
    t.director.start();
    t.fake.advanceTo(PHRASE - 10);
    t.director.end();
    for (let i = 1; i <= 3; i += 1) t.fake.advanceTo(i * PHRASE);
    expect(t.heard).toHaveLength(2);
  });

  it('stop() after end() starts a fresh run from Discovery at tick 0', () => {
    const t = setup();
    t.director.start();
    t.fake.advanceTo(10);
    t.director.end();
    t.director.stop();
    t.director.request({ era: 'discovery', arrangement: 'test-arrangement' });
    t.director.start();
    t.fake.advanceTo(0);
    expect(t.fake.log.at(-1)).toMatch(new RegExp(`@${PHRASE}$`));
    expect(t.director.snapshot().status).not.toBe('ended');
  });

  it('a care sound effect never changes the music plan or its random order', () => {
    const plain = setup();
    const withSfx = setup();
    plain.director.start();
    withSfx.director.start();
    for (let i = 0; i < 8; i += 1) {
      withSfx.director.playSfx('feed');
      plain.fake.advanceTo(i * PHRASE);
      withSfx.fake.advanceTo(i * PHRASE);
    }
    expect(withSfx.fake.log.filter((l) => l.startsWith('sfx'))).toHaveLength(8);
    expect(withSfx.fake.log.filter((l) => l.startsWith('schedule'))).toEqual(
      plain.fake.log.filter((l) => l.startsWith('schedule')),
    );
  });
});

describe('music director transitions', () => {
  function crossLibrary(extraPatterns: unknown[] = []) {
    const input = sources({
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
      patterns: [
        pattern({ id: 'disc-a' }),
        pattern({ id: 'sing-a', eraId: 'singularity' }),
        ...extraPatterns,
      ],
    });
    const { catalog, diagnostics } = buildCatalog(input);
    expect(diagnostics.filter((d) => d.level === 'error')).toEqual([]);
    return createLibrary(catalog, { candidates: 'all' });
  }

  it('changes tempo at the boundary without resetting the clock', () => {
    const t = setup(crossLibrary());
    t.director.start();
    t.fake.advanceTo(10);
    t.director.request({ era: 'singularity', arrangement: 'test-arrangement' });
    t.fake.advanceTo(PHRASE);
    expect(t.fake.tempoLog).toEqual(['120 @0', `100 @${PHRASE}`]);
    expect(t.fake.position()).toBe(PHRASE);
    expect(t.fake.log.at(-1)).toMatch(new RegExp(`@${2 * PHRASE}$`));
  });

  it('an optional stinger occupies its declared ticks before the new era', () => {
    const stinger = pattern({
      id: 'sting',
      bars: 1,
      harmony: [{ step: 0, length: 16, chord: 'C' }],
      tracks: { lead: [{ type: 'note', step: 0, length: 8, pitch: 'G5' }] },
    });
    const fake = createFakeBackend();
    const heard: string[] = [];
    const director = createDirector({
      backend: fake.port,
      library: crossLibrary([stinger]),
      seed: 5,
      transitions: [{ from: 'discovery', to: 'singularity', stinger: 'sting@1' }],
      onPhrase: (info) => heard.push(`${info.key}@${info.startTick}`),
    });
    director.request({ era: 'discovery', arrangement: 'test-arrangement' });
    director.start();
    fake.advanceTo(10);
    director.request({ era: 'singularity', arrangement: 'test-arrangement' });
    fake.advanceTo(PHRASE);
    fake.advanceTo(PHRASE + PHRASE / 4);
    expect(heard).toEqual(['disc-a@1@0', `sting@1@${PHRASE}`, `sing-a@1@${PHRASE + PHRASE / 4}`]);
  });

  it('a transition whose stinger is missing still switches cleanly', () => {
    const fake = createFakeBackend();
    const heard: string[] = [];
    const director = createDirector({
      backend: fake.port,
      library: crossLibrary(),
      seed: 5,
      transitions: [{ from: 'discovery', to: 'singularity', stinger: 'nope@1' }],
      onPhrase: (info) => heard.push(`${info.key}@${info.startTick}`),
    });
    director.request({ era: 'discovery', arrangement: 'test-arrangement' });
    director.start();
    fake.advanceTo(10);
    director.request({ era: 'singularity', arrangement: 'test-arrangement' });
    fake.advanceTo(PHRASE);
    expect(heard).toEqual(['disc-a@1@0', `sing-a@1@${PHRASE}`]);
  });
});

describe('music library', () => {
  const input = () =>
    sources({
      eras: [era()],
      arrangements: [arrangement()],
      patterns: [
        pattern({ id: 'demo-a', demo: true }),
        pattern({ id: 'plain-a', demo: false }),
        pattern({ id: 'plain-a', revision: 2, demo: false }),
      ],
    });

  it('approved uses only exact approved keys', () => {
    const lib = createLibrary(buildCatalog(input()).catalog, {
      candidates: 'approved',
      approved: new Set(['plain-a@1']),
    });
    expect(lib.bank('discovery').map((p) => `${p.id}@${p.revision}`)).toEqual(['plain-a@1']);
  });

  it('demo uses only demo material; all includes every valid version', () => {
    const catalog = buildCatalog(input()).catalog;
    expect(
      createLibrary(catalog, { candidates: 'demo' })
        .bank('discovery')
        .map((p) => p.id),
    ).toEqual(['demo-a']);
    expect(createLibrary(catalog, { candidates: 'all' }).all()).toHaveLength(3);
    expect(createLibrary(catalog, { candidates: 'approved' }).all()).toHaveLength(0);
  });
});
