import { describe, expect, it } from 'vitest';
import { TECHNOLOGY_IDS } from '../game/ids';
import type { MusicProjection } from '../game/selectors';
import { createDirector } from '../music/director';
import { libraryFromPack, type MusicPack } from '../music/pack';
import { createAudioPreferences } from '../music/preferences';
import demoPack from '../music/data/pack.demo.json';
import approvedPack from '../music/data/pack.approved.json';
import { createFakeBackend } from '../../tests/music/helpers/fakeBackend';
import type { AudioView } from '../ui/contracts';
import { createMusicBinding } from './musicBinding';

const PHRASE = 3072;
const upTo = (id: (typeof TECHNOLOGY_IDS)[number]) =>
  TECHNOLOGY_IDS.slice(0, TECHNOLOGY_IDS.indexOf(id) + 1);
const projection = (
  ids: readonly string[],
  extra: Partial<MusicProjection> = {},
): MusicProjection =>
  ({ technologyIds: ids, ended: false, runId: 'run-1', ...extra }) as MusicProjection;

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

function setup(
  options: { pack?: MusicPack; unlock?: () => Promise<void>; activation?: boolean } = {},
) {
  const fake = createFakeBackend();
  const storage = memory();
  const heard: { key: string; era: string; arrangement: string }[] = [];
  let loads = 0;
  let clock = 0;
  let view: AudioView | null = null;
  const pack = options.pack ?? (demoPack as unknown as MusicPack);
  const binding = createMusicBinding({
    preferences: createAudioPreferences(storage),
    userActivationActive: () => options.activation ?? true,
    now: () => clock,
    load: () => {
      loads += 1;
      const director = createDirector({
        backend: fake.port,
        library: libraryFromPack(pack),
        seed: 5,
        onPhrase: (i) => heard.push({ key: i.key, era: i.eraId, arrangement: i.arrangementId }),
      });
      return Promise.resolve({
        director,
        unlock: options.unlock ?? (() => Promise.resolve()),
        patterns: pack.manifest.length,
      });
    },
  });
  binding.controls.subscribe((v) => (view = v));
  return {
    fake,
    storage,
    heard,
    binding,
    loads: () => loads,
    advanceClock: (ms: number) => (clock += ms),
    view: () => {
      if (!view) throw new Error('no view');
      return view;
    },
  };
}

describe('music binding', () => {
  it('the Sound switch loads audio once, plays, and persists the choice', async () => {
    const t = setup();
    expect(t.view()).toMatchObject({ available: true, soundOn: false, status: 'off' });
    expect(t.loads()).toBe(0);
    await t.binding.controls.setSound(true);
    expect(t.view()).toMatchObject({ soundOn: true, status: 'playing' });
    t.fake.advanceTo(0);
    expect(t.heard[0]?.era).toBe('discovery');
    await t.binding.controls.setSound(false);
    await t.binding.controls.setSound(true);
    expect(t.loads()).toBe(1);
    expect(JSON.parse(t.storage.data.get('vibecoder.audio.v1') ?? '{}')).toMatchObject({
      soundOn: true,
    });
  });

  it('a refused audio unlock asks for another tap and never throws', async () => {
    const t = setup({ unlock: () => Promise.reject(new Error('NotAllowedError')) });
    await t.binding.controls.setSound(true);
    expect(t.view().status).toBe('needsGesture');
    expect(t.view().message).toMatch(/tap/i);
  });

  it('an empty approved pack is reported honestly instead of a silent "playing"', async () => {
    const t = setup({ pack: approvedPack as unknown as MusicPack });
    await t.binding.controls.setSound(true);
    expect(t.view().status).toBe('playing');
    expect(t.view().message).toMatch(/no approved soundtrack/i);
  });

  it('an unlock changes era at the next phrase boundary; duplicates do not restart anything', async () => {
    const t = setup();
    t.binding.project(projection(upTo('ai-native-ide')));
    await t.binding.controls.setSound(true);
    t.fake.advanceTo(0);
    expect(t.heard[0]).toMatchObject({ era: 'discovery', arrangement: 'discovery-support' });
    t.fake.advanceTo(10);
    t.binding.project(projection(upTo('autonomous-company')));
    t.binding.project(projection([...upTo('autonomous-company')].reverse()));
    const schedules = t.fake.log.filter((l) => l.startsWith('schedule')).length;
    t.binding.project(projection(upTo('autonomous-company')));
    expect(t.fake.log.filter((l) => l.startsWith('schedule')).length).toBe(schedules);
    t.fake.advanceTo(PHRASE);
    expect(t.heard.at(-1)).toMatchObject({ era: 'singularity' });
  });

  it('an ended run finishes the phrase and stops; a new run restarts from Discovery', async () => {
    const t = setup();
    t.binding.project(projection(upTo('autonomous-company')));
    await t.binding.controls.setSound(true);
    t.fake.advanceTo(0);
    t.fake.advanceTo(10);
    t.binding.project(projection(upTo('autonomous-company'), { ended: true }));
    for (let i = 1; i <= 3; i += 1) t.fake.advanceTo(i * PHRASE);
    expect(t.heard).toHaveLength(1);
    t.binding.project(projection([], { runId: 'run-2' }));
    expect(t.fake.position()).toBe(0);
    t.fake.advanceTo(0);
    expect(t.heard.at(-1)).toMatchObject({ era: 'discovery', arrangement: 'discovery-base' });
  });

  it('turning sound on after a new run while muted starts the new run, not the old one', async () => {
    const t = setup();
    t.binding.project(projection(upTo('parallel-agents')));
    await t.binding.controls.setSound(true);
    t.fake.advanceTo(0);
    await t.binding.controls.setSound(false);
    t.binding.project(projection([], { runId: 'run-2' }));
    await t.binding.controls.setSound(true);
    t.fake.advanceTo(0);
    expect(t.heard.at(-1)?.era).toBe('discovery');
  });

  it('background suspend silences immediately and wake resumes without catch-up', async () => {
    const t = setup();
    await t.binding.controls.setSound(true);
    t.fake.advanceTo(0);
    t.binding.suspend();
    expect(t.fake.port.state()).toBe('paused');
    t.binding.wake();
    expect(t.fake.port.state()).toBe('started');
  });

  it('applied care actions give a rate-limited sound effect; cat state is never an input', async () => {
    const t = setup();
    t.binding.facts([{ type: 'catCared', kind: 'feed' }]);
    expect(t.fake.log.filter((l) => l.startsWith('sfx'))).toHaveLength(0); // sound off
    await t.binding.controls.setSound(true);
    t.binding.facts([{ type: 'catCared', kind: 'feed' }]);
    t.binding.facts([{ type: 'catCared', kind: 'pet' }]);
    t.advanceClock(2000);
    t.binding.facts([{ type: 'catCared', kind: 'play' }, { type: 'catDied' }]);
    expect(t.fake.log.filter((l) => l.startsWith('sfx'))).toEqual(['sfx feed', 'sfx play']);
  });

  it('the same technologies with a living or a dead cat give the same musical plan', async () => {
    const run = async (catDied: boolean) => {
      const t = setup();
      t.binding.project(projection(upTo('custom-harness')));
      await t.binding.controls.setSound(true);
      for (let i = 0; i < 6; i += 1) {
        if (catDied && i === 2) t.binding.facts([{ type: 'catDied' }]);
        t.fake.advanceTo(i * PHRASE);
      }
      return t.fake.log.filter((l) => l.startsWith('schedule'));
    };
    expect(await run(true)).toEqual(await run(false));
  });
});
