/**
 * Local candidate patterns for the production Lab: a composer's JSON imported in this browser,
 * validated by the same schema/catalog code as the repository, kept in its own bounded storage
 * key. A candidate never replaces an installed version: the same id@revision with a different
 * payload is an explicit conflict (bump the revision). Nothing is written to a server.
 */
import { buildCatalog, type MusicSources } from '../music/core/catalog';
import { canonicalJson } from '../music/core/canonical';
import { LIMITS, validatePatternStructure } from '../music/core/schema';
import type { SaveResult, StorageLike } from './reviewStore';

export const CANDIDATES_KEY = 'vibecoder.music-candidates.v1';

export interface CandidateReport {
  readonly added: string[];
  readonly identical: string[];
  readonly conflicts: { key: string; reason: string }[];
  readonly rejected: { file: string; key?: string; problems: string[] }[];
}

const bytes = (text: string) => new TextEncoder().encode(text).length;
const keyOf = (value: unknown) => {
  const v = value as { id?: unknown; revision?: unknown };
  return typeof v.id === 'string' && typeof v.revision === 'number'
    ? `${v.id}@${v.revision}`
    : undefined;
};
/** Musical identity for conflict checks (descriptive metadata excluded, key order ignored). */
const payloadOf = (value: unknown) => {
  const { metadata: _metadata, ...rest } = value as Record<string, unknown>;
  return canonicalJson(rest);
};

export function importCandidateText(
  text: string,
  file: string,
  installed: MusicSources,
  existing: readonly unknown[],
): { candidates: unknown[]; report: CandidateReport } {
  const report: CandidateReport = { added: [], identical: [], conflicts: [], rejected: [] };
  const candidates = [...existing];
  if (bytes(text) > LIMITS.batchBytes) {
    report.rejected.push({ file, problems: [`file too large (limit ${LIMITS.batchBytes} bytes)`] });
    return { candidates, report };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    report.rejected.push({ file, problems: [`not valid JSON: ${String(error)}`] });
    return { candidates, report };
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (items.length > LIMITS.patternsPerBatch) {
    report.rejected.push({
      file,
      problems: [`a file may hold at most ${LIMITS.patternsPerBatch} patterns (${items.length})`],
    });
    return { candidates, report };
  }
  items.forEach((item, index) => {
    const where = items.length > 1 ? `${file}[${index}]` : file;
    const key = keyOf(item);
    if (bytes(JSON.stringify(item)) > LIMITS.patternBytes) {
      report.rejected.push({
        file: where,
        ...(key ? { key } : {}),
        problems: ['pattern too large'],
      });
      return;
    }
    const structure = validatePatternStructure(item);
    if (!structure.value) {
      report.rejected.push({
        file: where,
        ...(key ? { key } : {}),
        problems: structure.errors.map((e) => `${e.path} ${e.message}`),
      });
      return;
    }
    const k = `${structure.value.id}@${structure.value.revision}`;
    const installedTwin = installed.patterns.find((p) => keyOf(p) === k);
    if (installedTwin) {
      if (payloadOf(installedTwin) === payloadOf(item)) report.identical.push(k);
      else
        report.conflicts.push({
          key: k,
          reason:
            'an installed version has this id and revision with different music; use a new revision',
        });
      return;
    }
    const localIndex = candidates.findIndex((p) => keyOf(p) === k);
    if (localIndex >= 0) {
      if (payloadOf(candidates[localIndex]) === payloadOf(item)) report.identical.push(k);
      else
        report.conflicts.push({
          key: k,
          reason:
            'a local candidate has this id and revision with different music; use a new revision',
        });
      return;
    }
    // Catalog-level checks (era, motif, roles) against the installed eras/presets/arrangements.
    const { diagnostics } = buildCatalog({ ...installed, patterns: [item] });
    const errors = diagnostics.filter((d) => d.level === 'error').map((d) => d.message);
    if (errors.length > 0) {
      report.rejected.push({ file: where, key: k, problems: errors });
      return;
    }
    candidates.push(item);
    report.added.push(k);
  });
  return { candidates, report };
}

export interface CandidateStore {
  load(): { patterns: unknown[]; error: string | null };
  save(patterns: readonly unknown[]): SaveResult;
}

export function createCandidateStore(storage: StorageLike | null): CandidateStore {
  return {
    load() {
      try {
        const text = storage?.getItem(CANDIDATES_KEY) ?? null;
        if (text === null) return { patterns: [], error: null };
        const value = JSON.parse(text) as { schemaVersion?: unknown; patterns?: unknown };
        if (value.schemaVersion !== 1 || !Array.isArray(value.patterns)) {
          return { patterns: [], error: 'Stored candidates are unreadable and were ignored.' };
        }
        return { patterns: value.patterns as unknown[], error: null };
      } catch {
        return { patterns: [], error: 'Stored candidates are unreadable and were ignored.' };
      }
    },
    save(patterns) {
      if (!storage) return { ok: false, error: 'Browser storage is not available.' };
      const text = JSON.stringify({ schemaVersion: 1, patterns });
      if (bytes(text) > LIMITS.batchBytes) {
        return { ok: false, error: `Local candidates exceed ${LIMITS.batchBytes} bytes.` };
      }
      try {
        storage.setItem(CANDIDATES_KEY, text);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof DOMException && /quota/i.test(`${error.name} ${error.message}`)
              ? 'Browser storage is full: the candidate was not saved.'
              : `Candidates could not be saved: ${String(error)}`,
        };
      }
    },
  };
}
