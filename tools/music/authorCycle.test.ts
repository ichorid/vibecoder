/**
 * S09.2: the author's full cycle from music/README.md, without chat history, on a temporary copy
 * of the repository. The "human decision" is a test-only approval record, clearly labelled.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../src/music/core/catalog';
import { createDirector } from '../../src/music/director';
import { contentHash } from '../../src/music/hash';
import { libraryFromPack } from '../../src/music/pack';
import { createAudioPreferences } from '../../src/music/preferences';
import { createLabController, type LabState } from '../../src/music-lab/labController';
import { createFakeBackend } from '../../tests/music/helpers/fakeBackend';
import { buildPack } from './packLib';
import { generatePrompt } from './promptLib';
import { readRepository } from './sources';

const candidate = {
  schemaVersion: 1,
  id: 'author-cycle-sketch',
  revision: 1,
  eraId: 'singularity',
  bars: 4,
  key: { tonic: 'C', mode: 'phrygian' },
  harmony: [{ step: 0, length: 64, chord: 'Cm' }],
  energy: 0.25,
  tracks: {
    lead: [
      { type: 'note', step: 0, length: 4, pitch: 'Eb5' },
      { type: 'note', step: 4, length: 4, pitch: 'G5' },
      { type: 'note', step: 8, length: 8, pitch: 'Ab5' },
      { type: 'note', step: 16, length: 16, pitch: 'G5' },
    ],
    bass: [{ type: 'note', step: 0, length: 64, pitch: 'C2' }],
  },
  boundary: { entryGroup: 'tonic', exitGroup: 'tonic' },
  motifRef: { id: 'demo-main', revision: 1 },
  license: 'CC0-1.0',
  demo: false,
  metadata: { description: 'Infrastructure test candidate (not a composition for the game).' },
};

describe('author cycle without chat history', () => {
  it('candidate → validate → review export → approved pack → played by the game director', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'vibe-author-'));
    cpSync('music', root, { recursive: true });
    const file = path.join(root, 'patterns/singularity/author-cycle-sketch.v1.json');
    writeFileSync(file, JSON.stringify(candidate, null, 2));

    const validate = spawnSync(
      'npx',
      ['vite-node', 'tools/music/validate.ts', '--', '--root', root, '--era', 'singularity'],
      { encoding: 'utf8' },
    );
    expect(validate.status).toBe(0);
    expect(validate.stdout).toMatch(/3 patterns, 0 errors/);

    const { catalog } = buildCatalog(readRepository(root));
    const doc = catalog.patterns.find((p) => p.id === candidate.id);
    if (!doc) throw new Error('candidate missing');
    const hash = await contentHash(doc, catalog);
    mkdirSync(path.join(root, 'reviews'), { recursive: true });
    writeFileSync(
      path.join(root, 'reviews', 'test-only-approval.json'),
      JSON.stringify({
        schemaVersion: 1,
        kind: 'vibe-coder-music-reviews',
        records: [
          {
            schemaVersion: 1,
            patternId: candidate.id,
            revision: 1,
            contentHash: hash,
            status: 'approved',
            rating: 4,
          },
        ],
      }),
    );

    const { pack, errors } = await buildPack({ root, mode: 'approved' });
    expect(errors).toEqual([]);
    expect(pack?.manifest).toEqual([
      expect.objectContaining({ id: candidate.id, contentHash: hash, demo: false }),
    ]);
    if (!pack) throw new Error('no pack');

    const fake = createFakeBackend();
    const heard: string[] = [];
    const director = createDirector({
      backend: fake.port,
      library: libraryFromPack(pack),
      seed: 1,
      onPhrase: (i) => heard.push(i.key),
    });
    director.request({ era: 'singularity', arrangement: 'singularity-base' });
    director.start();
    fake.advanceTo(0);
    expect(heard).toEqual(['author-cycle-sketch@1']);
  });

  it('the Lab and the CLI produce the same task for an era (the CLI adds only its template)', async () => {
    const cli = await generatePrompt({ root: 'music', era: 'recursion', template: 'era' });
    if (!cli.ok) throw new Error(cli.error);
    let state: LabState | null = null;
    const storage = { getItem: () => null, setItem: () => {} };
    const lab = createLabController({
      sources: readRepository('music'),
      seed: 1,
      preferences: createAudioPreferences(storage),
      load: () => Promise.reject(new Error('no audio in this test')),
      onState: (s) => (state = s),
    });
    await lab.ready();
    expect(state).not.toBeNull();
    const fromLab = lab.feedbackPrompt('recursion');
    if (!fromLab.ok) throw new Error(fromLab.error);
    const task = cli.value.slice(cli.value.indexOf('# Composer task'));
    expect(task).toBe(fromLab.value);
    for (const section of [
      '## Scope',
      '## Era',
      '## Motif',
      'TEMPORARY DEMO',
      '## Pattern schema',
      'CC0-1.0',
      'music/patterns/recursion/',
    ]) {
      expect(task).toContain(section);
    }
    expect(readFileSync('music/README.md', 'utf8')).toMatch(/worktree/i);
  });
});
