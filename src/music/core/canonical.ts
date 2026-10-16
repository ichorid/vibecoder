/**
 * Canonical review payload (sound architecture §9). A review approves exactly what sounds:
 *
 * - the pattern document without `metadata` (descriptions/composer notes do not sound);
 * - its era document (clock, key, default arrangement);
 * - its motif document;
 * - the era's default arrangement (the role → preset map used for ranges and the base mix);
 * - the presets that arrangement assigns to roles the pattern actually has events for.
 *
 * Other patterns, reviews, catalog order and unused presets are excluded, so adding unrelated
 * material never makes an approval stale. Serialisation: object keys sorted (UTF-16 order),
 * arrays kept in order, no whitespace, non-finite numbers rejected.
 */
import type { MusicCatalog } from './catalog';
import type { PatternDocument } from '../data/patterns.generated';

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonical JSON: non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  throw new Error(`canonical JSON: unsupported ${typeof value}`);
}

export function reviewPayload(pattern: PatternDocument, catalog: MusicCatalog) {
  const { metadata: _metadata, ...music } = pattern;
  const era = catalog.eras.get(pattern.eraId) ?? null;
  const arrangement = era ? (catalog.arrangements.get(era.defaultArrangement) ?? null) : null;
  const usedRoles = Object.entries(pattern.tracks)
    .filter(([, events]) => (events?.length ?? 0) > 0)
    .map(([role]) => role)
    .sort();
  const presets: Record<string, unknown> = {};
  for (const role of usedRoles) {
    const id = arrangement?.roles[role]?.preset;
    if (id) presets[id] = catalog.presets.get(id) ?? null;
  }
  const motif = catalog.motifs.get(pattern.motifRef.id) ?? null;
  return { schemaVersion: 1, pattern: music, era, motif, arrangement, presets };
}

export const canonicalPayload = (pattern: PatternDocument, catalog: MusicCatalog): string =>
  canonicalJson(reviewPayload(pattern, catalog));
