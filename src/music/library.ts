/**
 * A playable view of a validated catalog: per-era banks of normalized pattern versions under an
 * explicit candidate policy. `approved` uses only exact approved keys; `demo` only demo
 * material; `all` (Lab audition) any version without hard errors. Nothing invalid is playable.
 */
import type { MusicCatalog } from './core/catalog';
import { analyzePattern, type NormalizedPattern } from './core/validation';
import type { ArrangementDocument, EraDocument, PresetDocument } from './data/patterns.generated';

export type CandidatePolicy = 'all' | 'demo' | 'approved';

export interface LibraryOptions {
  readonly candidates: CandidatePolicy;
  /** Exact `id@revision` keys with a current (non-stale) approval. */
  readonly approved?: ReadonlySet<string>;
  /** Lab-only: an empty era bank may borrow its declared demo fallback era (labelled). */
  readonly demoFallback?: boolean;
}

export interface MusicLibrary {
  readonly eras: ReadonlyMap<string, EraDocument>;
  readonly arrangements: ReadonlyMap<string, ArrangementDocument>;
  readonly presets: ReadonlyMap<string, PresetDocument>;
  readonly options: LibraryOptions;
  bank(eraId: string): readonly NormalizedPattern[];
  pattern(key: string): NormalizedPattern | undefined;
  all(): readonly NormalizedPattern[];
}

export const patternKey = (p: { id: string; revision: number }) => `${p.id}@${p.revision}`;

export function createLibrary(catalog: MusicCatalog, options: LibraryOptions): MusicLibrary {
  const playable = new Map<string, NormalizedPattern>();
  for (const document of catalog.patterns) {
    const key = patternKey(document);
    const include =
      options.candidates === 'all' ||
      (options.candidates === 'demo' && document.demo) ||
      (options.candidates === 'approved' && (options.approved?.has(key) ?? false));
    if (!include) continue;
    const { normalized } = analyzePattern(document, catalog);
    if (normalized) playable.set(key, normalized);
  }
  const banks = new Map<string, NormalizedPattern[]>();
  for (const pattern of playable.values()) {
    const bank = banks.get(pattern.eraId) ?? [];
    bank.push(pattern);
    banks.set(pattern.eraId, bank);
  }
  return {
    eras: catalog.eras,
    arrangements: catalog.arrangements,
    presets: catalog.presets,
    options,
    bank: (eraId) => banks.get(eraId) ?? [],
    pattern: (key) => playable.get(key),
    all: () => [...playable.values()],
  };
}
