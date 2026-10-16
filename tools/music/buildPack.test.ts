import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../src/music/core/catalog';
import { createDirector } from '../../src/music/director';
import { contentHash } from '../../src/music/hash';
import { libraryFromPack } from '../../src/music/pack';
import { createFakeBackend } from '../../tests/music/helpers/fakeBackend';
import { buildPack } from './packLib';
import { readRepository } from './sources';

function corpus(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vibe-music-'));
  cpSync('music', dir, { recursive: true });
  return dir;
}

async function hashOf(root: string, id: string, revision = 1): Promise<string> {
  const { catalog } = buildCatalog(readRepository(root));
  const p = catalog.patterns.find((x) => x.id === id && x.revision === revision);
  if (!p) throw new Error(`missing ${id}@${revision}`);
  return contentHash(p, catalog);
}

function writeReviews(root: string, name: string, records: object[]) {
  mkdirSync(path.join(root, 'reviews'), { recursive: true });
  writeFileSync(
    path.join(root, 'reviews', name),
    JSON.stringify({ schemaVersion: 1, kind: 'vibe-coder-music-reviews', records }),
  );
}

const record = (patternId: string, contentHash: string, status: string, revision = 1) => ({
  schemaVersion: 1,
  patternId,
  revision,
  contentHash,
  status,
});

function addRevision(root: string, id: string, era: string, change: Record<string, unknown>) {
  const file = path.join(root, 'patterns', era, `${id}.v1.json`);
  const doc = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(
    path.join(root, 'patterns', era, `${id}.v2.json`),
    JSON.stringify({ ...doc, revision: 2, ...change }),
  );
}

describe('music pack builder', () => {
  it('without exported reviews the approved pack is empty, with per-era diagnostics', async () => {
    const result = await buildPack({ root: corpus(), mode: 'approved' });
    expect(result.errors).toEqual([]);
    expect(result.pack?.patterns).toEqual([]);
    expect(result.warnings.join('\n')).toMatch(/discovery: no approved patterns/);
  });

  it('publishes exactly the exported, current approvals with hash and license', async () => {
    const root = corpus();
    const hash = await hashOf(root, 'discovery-demo-a');
    writeReviews(root, 'mine.json', [
      record('discovery-demo-a', hash, 'approved'),
      record('discovery-demo-b', await hashOf(root, 'discovery-demo-b'), 'rejected'),
      record('singularity-demo-a', await hashOf(root, 'singularity-demo-a'), 'revise'),
    ]);
    const result = await buildPack({ root, mode: 'approved' });
    expect(result.errors).toEqual([]);
    expect(result.pack?.manifest).toEqual([
      expect.objectContaining({
        id: 'discovery-demo-a',
        revision: 1,
        contentHash: hash,
        license: 'CC0-1.0',
        demo: true,
      }),
    ]);
  });

  it('a stale approval (music changed after review) is not published', async () => {
    const root = corpus();
    const hash = await hashOf(root, 'discovery-demo-a');
    writeReviews(root, 'mine.json', [record('discovery-demo-a', hash, 'approved')]);
    const file = path.join(root, 'patterns/discovery/discovery-demo-a.v1.json');
    const doc = JSON.parse(readFileSync(file, 'utf8')) as { energy: number };
    writeFileSync(file, JSON.stringify({ ...doc, energy: 0.45 }));
    const result = await buildPack({ root, mode: 'approved' });
    expect(result.pack?.patterns).toEqual([]);
    expect(result.warnings.join('\n')).toMatch(/discovery-demo-a@1: stale approval/);
  });

  it('two approved revisions of one id need an explicit choice', async () => {
    const root = corpus();
    addRevision(root, 'discovery-demo-a', 'discovery', { energy: 0.5 });
    writeReviews(root, 'mine.json', [
      record('discovery-demo-a', await hashOf(root, 'discovery-demo-a', 1), 'approved', 1),
      record('discovery-demo-a', await hashOf(root, 'discovery-demo-a', 2), 'approved', 2),
    ]);
    const ambiguous = await buildPack({ root, mode: 'approved' });
    expect(ambiguous.pack).toBeNull();
    expect(ambiguous.errors.join()).toMatch(/discovery-demo-a: approved revisions 1, 2.*--choose/);
    const chosen = await buildPack({ root, mode: 'approved', choose: ['discovery-demo-a@2'] });
    expect(chosen.errors).toEqual([]);
    expect(chosen.pack?.manifest.map((m) => `${m.id}@${m.revision}`)).toEqual([
      'discovery-demo-a@2',
    ]);
  });

  it('conflicting exported decisions for one exact version fail the build', async () => {
    const root = corpus();
    const hash = await hashOf(root, 'discovery-demo-a');
    writeReviews(root, 'a.json', [record('discovery-demo-a', hash, 'approved')]);
    writeReviews(root, 'b.json', [record('discovery-demo-a', hash, 'rejected')]);
    const result = await buildPack({ root, mode: 'approved' });
    expect(result.pack).toBeNull();
    expect(result.errors.join()).toMatch(/conflicting decisions.*discovery-demo-a@1/);
  });

  it('the demo pack is an explicit separate mode, flagged as demo', async () => {
    const result = await buildPack({ root: corpus(), mode: 'demo' });
    expect(result.pack?.mode).toBe('demo');
    expect(result.pack?.manifest.map((m) => m.id).sort()).toEqual([
      'discovery-demo-a',
      'discovery-demo-b',
      'singularity-demo-a',
      'singularity-demo-b',
    ]);
    expect(result.pack?.manifest.every((m) => m.demo)).toBe(true);
  });

  it('a newly approved pattern plays from the pack without any player change', async () => {
    const root = corpus();
    writeReviews(root, 'mine.json', [
      record('singularity-demo-b', await hashOf(root, 'singularity-demo-b'), 'approved'),
    ]);
    const { pack } = await buildPack({ root, mode: 'approved' });
    if (!pack) throw new Error('no pack');
    const fake = createFakeBackend();
    const heard: string[] = [];
    const director = createDirector({
      backend: fake.port,
      library: libraryFromPack(pack),
      seed: 1,
      onPhrase: (info) => heard.push(info.key),
    });
    director.request({ era: 'singularity', arrangement: 'singularity-base' });
    director.start();
    fake.advanceTo(0);
    expect(heard).toEqual(['singularity-demo-b@1']);
  });
});
