/**
 * `music:pack` logic. Reads the repository and the exported reviews in `music/reviews/`,
 * recomputes every content hash, and publishes one approved revision per pattern ID. Stale,
 * rejected, revise, unreviewed and invalid material never ships; ambiguity (two approved
 * revisions of one ID) needs an explicit `--choose id@rev`. The demo pack is a separate mode.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { buildCatalog } from '../../src/music/core/catalog';
import { checkBankCompatibility, DEFAULT_BOUNDARY_RULES } from '../../src/music/core/compatibility';
import { analyzePattern, type NormalizedPattern } from '../../src/music/core/validation';
import type { PatternDocument, ReviewDocument } from '../../src/music/data/patterns.generated';
import { contentHash } from '../../src/music/hash';
import type { MusicPack, PackEntry } from '../../src/music/pack';
import { decodeReviewEnvelope, exactKey } from '../../src/music-lab/reviews';
import { readRepository } from './sources';

export interface PackOptions {
  readonly root: string;
  readonly mode: 'approved' | 'demo';
  /** Explicit `id@revision` choices when several revisions of one ID are approved. */
  readonly choose?: readonly string[];
}

export interface PackResult {
  readonly pack: MusicPack | null;
  readonly errors: string[];
  readonly warnings: string[];
}

export function readReviews(root: string, errors: string[]): ReviewDocument[] {
  const dir = path.join(root, 'reviews');
  if (!existsSync(dir)) return [];
  const byKey = new Map<string, { record: ReviewDocument; file: string }>();
  for (const name of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const decoded = decodeReviewEnvelope(readFileSync(path.join(dir, name), 'utf8'));
    if (!decoded.ok) {
      errors.push(`reviews/${name}: ${decoded.error}`);
      continue;
    }
    for (const record of decoded.value) {
      const key = exactKey(record);
      const seen = byKey.get(key);
      if (seen && seen.record.status !== record.status) {
        errors.push(
          `conflicting decisions for ${record.patternId}@${record.revision} (${seen.record.status} in ${seen.file}, ${record.status} in ${name}); resolve them in the Lab and export again`,
        );
      }
      byKey.set(key, { record, file: name });
    }
  }
  return [...byKey.values()].map((v) => v.record);
}

export async function buildPack(options: PackOptions): Promise<PackResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sources = readRepository(options.root);
  const { catalog, diagnostics } = buildCatalog(sources);
  for (const d of diagnostics.filter((x) => x.level === 'error'))
    warnings.push(`excluded: ${d.message}`);
  const reviews = readReviews(options.root, errors);

  const valid = new Map<
    string,
    { doc: PatternDocument; normalized: NormalizedPattern; hash: string }
  >();
  for (const doc of catalog.patterns) {
    const { normalized } = analyzePattern(doc, catalog);
    const key = `${doc.id}@${doc.revision}`;
    if (!normalized) {
      warnings.push(`excluded: ${key} has validation errors`);
      continue;
    }
    valid.set(key, { doc, normalized, hash: await contentHash(doc, catalog) });
  }

  let chosen: { doc: PatternDocument; normalized: NormalizedPattern; hash: string }[] = [];
  if (options.mode === 'demo') {
    chosen = [...valid.values()].filter((v) => v.doc.demo);
  } else {
    const approvedById = new Map<string, typeof chosen>();
    for (const record of reviews.filter((r) => r.status === 'approved')) {
      const key = `${record.patternId}@${record.revision}`;
      const current = valid.get(key);
      if (!current) {
        warnings.push(`${key}: approved, but no valid version with this id/revision exists`);
        continue;
      }
      if (current.hash !== record.contentHash) {
        warnings.push(`${key}: stale approval (the music changed after review); not published`);
        continue;
      }
      approvedById.set(record.patternId, [...(approvedById.get(record.patternId) ?? []), current]);
    }
    for (const [id, versions] of [...approvedById.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (versions.length === 1) {
        chosen.push(...versions);
        continue;
      }
      const pick = versions.find((v) => options.choose?.includes(`${id}@${v.doc.revision}`));
      if (pick) chosen.push(pick);
      else {
        const revisions = versions.map((v) => v.doc.revision).sort((a, b) => a - b);
        errors.push(
          `${id}: approved revisions ${revisions.join(', ')}; publish exactly one with --choose ${id}@${revisions.at(-1)}`,
        );
      }
    }
  }

  // Every allowed neighbour pair of each published bank (including rollover) must be compatible.
  for (const era of catalog.eras.keys()) {
    const bank = chosen.filter((c) => c.doc.eraId === era).map((c) => c.normalized);
    if (bank.length === 0) {
      warnings.push(`${era}: no ${options.mode} patterns (the game stays silent for this era)`);
      continue;
    }
    for (const problem of checkBankCompatibility(bank, DEFAULT_BOUNDARY_RULES)) {
      errors.push(`${era}: ${problem}`);
    }
  }
  if (errors.length > 0) return { pack: null, errors, warnings };

  chosen.sort((a, b) => a.doc.eraId.localeCompare(b.doc.eraId) || a.doc.id.localeCompare(b.doc.id));
  const manifest: PackEntry[] = chosen.map(({ doc, hash }) => ({
    id: doc.id,
    revision: doc.revision,
    eraId: doc.eraId,
    contentHash: hash,
    license: doc.license,
    ...(doc.attribution ? { attribution: doc.attribution } : {}),
    ...(doc.metadata?.composer ? { composer: doc.metadata.composer } : {}),
    demo: doc.demo,
  }));
  const motifIds = new Set(chosen.map((c) => c.doc.motifRef.id));
  const byId = <T extends { id: string }>(items: Iterable<T>) =>
    [...items].sort((a, b) => a.id.localeCompare(b.id));
  const pack: MusicPack = {
    schemaVersion: 1,
    mode: options.mode,
    eras: byId(catalog.eras.values()),
    presets: byId(catalog.presets.values()),
    arrangements: byId(catalog.arrangements.values()),
    motifs: byId([...catalog.motifs.values()].filter((m) => motifIds.has(m.id))),
    // Published payloads drop descriptive metadata (composer notes stay in the repository).
    patterns: chosen.map(({ doc }) => {
      const { metadata: _metadata, ...music } = doc;
      return music;
    }),
    manifest,
    diagnostics: warnings.filter((w) => /no .* patterns/.test(w)),
  };
  return { pack, errors, warnings };
}

export const packFile = (mode: 'approved' | 'demo') => `src/music/data/pack.${mode}.json`;
export const serializePack = (pack: MusicPack) => `${JSON.stringify(pack, null, 2)}\n`;
