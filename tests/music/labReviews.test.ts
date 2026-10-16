import { describe, expect, it } from 'vitest';
import { createCandidateStore } from '../../src/music-lab/candidates';
import { createLabController, type LabState } from '../../src/music-lab/labController';
import { createReviewStore } from '../../src/music-lab/reviewStore';
import { createAudioPreferences } from '../../src/music/preferences';
import { readRepository } from '../../tools/music/sources';
import { createFakeBackend } from './helpers/fakeBackend';

function first<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error('expected an item');
  return item;
}

const PHRASE = 3072;

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

async function open(
  storage = memory(),
  patch: (repo: ReturnType<typeof readRepository>) => void = () => {},
) {
  const repo = readRepository('music');
  patch(repo);
  const fake = createFakeBackend();
  let state: LabState | null = null;
  const lab = createLabController({
    sources: repo,
    seed: 3,
    preferences: createAudioPreferences(storage),
    reviews: createReviewStore(storage),
    candidates: createCandidateStore(storage),
    load: () => Promise.resolve({ backend: fake.port, unlock: () => Promise.resolve() }),
    onState: (s) => (state = s),
    now: () => '2026-10-16T12:00:00.000Z',
  });
  await lab.ready();
  const get = () => {
    if (!state) throw new Error('no state');
    return state;
  };
  const entry = (key: string) => {
    const found = get().entries.find((e) => e.key === key);
    if (!found) throw new Error(`no ${key}`);
    return found;
  };
  return { lab, fake, storage, state: get, entry };
}

describe('lab reviews', () => {
  it('every version gets a SHA-256 and starts unreviewed', async () => {
    const t = await open();
    expect(t.state().reviews.ready).toBe(true);
    for (const e of t.state().entries) {
      expect(e.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(e.review).toMatchObject({ status: 'unreviewed', stale: false });
    }
  });

  it('approved versions form the Random approved bank; revise and reject never do', async () => {
    const t = await open();
    t.lab.decide('discovery-demo-a@1', 'approved');
    t.lab.decide('discovery-demo-b@1', 'revise');
    t.lab.decide('singularity-demo-a@1', 'rejected');
    t.lab.setMode('random');
    expect(t.state().random).toMatchObject({ includeDemo: false, candidates: 1 });
    await t.lab.play();
    const heard = new Set<string>();
    for (let i = 0; i < 8; i += 1) {
      t.fake.advanceTo(i * PHRASE);
      heard.add(t.state().now?.key ?? '');
    }
    expect(heard).toEqual(new Set(['discovery-demo-a@1']));
  });

  it('a new approval joins a playing approved sequence at the next safe boundary', async () => {
    const t = await open();
    t.lab.decide('discovery-demo-a@1', 'approved');
    t.lab.setMode('random');
    await t.lab.play();
    t.fake.advanceTo(10);
    t.lab.decide('discovery-demo-b@1', 'approved');
    expect(t.state().now?.key).toBe('discovery-demo-a@1');
    const heard: string[] = [];
    for (let i = 1; i < 8; i += 1) {
      t.fake.advanceTo(i * PHRASE);
      heard.push(t.state().now?.key ?? '');
    }
    expect(heard).toContain('discovery-demo-b@1');
  });

  it('feedback drafts, ratings and decisions survive a reload', async () => {
    const storage = memory();
    const t = await open(storage);
    t.lab.rate('singularity-demo-b@1', 4);
    t.lab.setDraft('singularity-demo-b@1', 'darker please');
    const again = await open(storage);
    expect(again.entry('singularity-demo-b@1')).toMatchObject({
      draft: 'darker please',
      review: { rating: 4 },
    });
    again.lab.decide('singularity-demo-b@1', 'revise');
    const third = await open(storage);
    expect(third.entry('singularity-demo-b@1').review).toMatchObject({
      status: 'revise',
      feedback: 'darker please',
    });
  });

  it('changing the music of the same id@revision makes the approval stale', async () => {
    const storage = memory();
    const t = await open(storage);
    t.lab.decide('discovery-demo-a@1', 'approved');
    const changed = await open(storage, (repo) => {
      const target = repo.patterns.find((p) => (p as { id: string }).id === 'discovery-demo-a') as {
        energy: number;
      };
      target.energy = 0.41;
    });
    expect(changed.entry('discovery-demo-a@1').review).toMatchObject({
      status: 'unreviewed',
      stale: true,
      staleStatus: 'approved',
    });
    changed.lab.setMode('random');
    expect(changed.state().random.candidates).toBe(0);
  });

  it('a hard-invalid local candidate shows diagnostics and cannot be approved', async () => {
    const t = await open();
    const demo = JSON.parse(t.lab.exportPattern('discovery-demo-a@1') ?? '{}') as Record<
      string,
      unknown
    >;
    const bad = {
      ...demo,
      id: 'too-high',
      tracks: { lead: [{ type: 'note', step: 0, length: 4, pitch: 'C8' }] },
    };
    t.lab.importCandidates(JSON.stringify(bad), 'bad.json');
    await t.lab.ready();
    expect(t.entry('too-high@1')).toMatchObject({ local: true, playable: false });
    t.lab.decide('too-high@1', 'approved');
    expect(t.state().message).toMatch(/cannot be approved/);
    expect(t.entry('too-high@1').review?.status).toBe('unreviewed');
  });

  it('a new revision imported locally is unreviewed, plays, persists and exports as editable JSON', async () => {
    const storage = memory();
    const t = await open(storage);
    t.lab.decide('discovery-demo-a@1', 'approved');
    const demo = JSON.parse(t.lab.exportPattern('discovery-demo-a@1') ?? '{}') as Record<
      string,
      unknown
    >;
    const next = { ...demo, revision: 2, energy: 0.6 };
    const report = t.lab.importCandidates(JSON.stringify(next), 'demo-a.v2.json');
    expect(report.added).toEqual(['discovery-demo-a@2']);
    await t.lab.ready();
    expect(t.entry('discovery-demo-a@2')).toMatchObject({
      local: true,
      review: { status: 'unreviewed', stale: false },
    });
    expect(t.entry('discovery-demo-a@1').review?.status).toBe('approved');
    t.lab.select('discovery-demo-a@2');
    await t.lab.play();
    t.fake.advanceTo(0);
    expect(t.state().now?.key).toBe('discovery-demo-a@2');

    const clash = t.lab.importCandidates(JSON.stringify({ ...next, energy: 0.7 }), 'again.json');
    expect(clash.conflicts).toHaveLength(1);

    const reloaded = await open(storage);
    expect(reloaded.entry('discovery-demo-a@2').local).toBe(true);
    expect(JSON.parse(reloaded.lab.exportPattern('discovery-demo-a@2') ?? '{}')).toEqual(next);
    reloaded.lab.removeCandidate('discovery-demo-a@2');
    expect(reloaded.state().entries.some((e) => e.key === 'discovery-demo-a@2')).toBe(false);
  });

  it('review import shows conflicts and resolves them only by an explicit choice', async () => {
    const mine = await open();
    mine.lab.decide('discovery-demo-a@1', 'approved');
    const theirs = await open();
    theirs.lab.decide('discovery-demo-a@1', 'rejected');
    theirs.lab.decide('singularity-demo-a@1', 'approved');
    mine.lab.importReviews(theirs.lab.exportReviews());
    expect(mine.state().reviews.conflicts).toHaveLength(1);
    expect(mine.entry('discovery-demo-a@1').review?.status).toBe('approved');
    expect(mine.entry('singularity-demo-a@1').review?.status).toBe('approved');
    const conflict = first(mine.state().reviews.conflicts);
    mine.lab.resolveConflict(conflict.key, 'use-import');
    expect(mine.entry('discovery-demo-a@1').review?.status).toBe('rejected');
    expect(mine.state().reviews.conflicts).toEqual([]);
    mine.lab.importReviews('{"nope":true}');
    expect(mine.state().message).toMatch(/not imported/);
  });

  it('a conflicting import while a candidate plays changes neither the music nor the catalog', async () => {
    const t = await open();
    const demo = JSON.parse(t.lab.exportPattern('discovery-demo-a@1') ?? '{}') as Record<
      string,
      unknown
    >;
    const mine = { ...demo, id: 'mine', energy: 0.6 };
    t.lab.importCandidates(JSON.stringify(mine), 'mine.json');
    await t.lab.ready();
    t.lab.select('mine@1');
    await t.lab.play();
    t.fake.advanceTo(0);
    const before = t.state().entries.map((e) => `${e.key}#${e.hash}`);
    const clash = t.lab.importCandidates(JSON.stringify({ ...mine, energy: 0.9 }), 'clash.json');
    await t.lab.ready();
    expect(clash.conflicts).toHaveLength(1);
    t.fake.advanceTo(PHRASE);
    expect(t.state().now?.key).toBe('mine@1');
    expect(t.state().entries.map((e) => `${e.key}#${e.hash}`)).toEqual(before);
  });
});
