/** `music:validate` logic: catalog + semantics for a corpus, optionally one era. */
import { buildCatalog, type Diagnostic } from '../../src/music/core/catalog';
import { analyzePattern } from '../../src/music/core/validation';
import { readRepository } from './sources';

export interface ValidationReport {
  readonly errors: readonly Diagnostic[];
  readonly warnings: readonly Diagnostic[];
  readonly patterns: number;
}

export function validateCorpus(root: string, era?: string): ValidationReport {
  const sources = readRepository(root);
  const { catalog, diagnostics } = buildCatalog(sources);
  if (era !== undefined && !catalog.eras.has(era)) {
    return {
      errors: [{ level: 'error', source: 'cli', path: '--era', message: `unknown era "${era}"` }],
      warnings: [],
      patterns: 0,
    };
  }
  const all: Diagnostic[] = [
    ...sources.parseErrors.map((d): Diagnostic => ({
      level: 'error',
      source: d.file,
      path: '/',
      message: `${d.file}: invalid JSON`,
    })),
    ...diagnostics.filter(
      (d) =>
        era === undefined || !d.source.startsWith('pattern') || d.message.includes(era) || true,
    ),
  ];
  const selected = catalog.patterns.filter((p) => era === undefined || p.eraId === era);
  for (const pattern of selected) all.push(...analyzePattern(pattern, catalog).diagnostics);
  const relevant = all.filter((d) => {
    if (era === undefined || !d.source.startsWith('pattern ')) return true;
    const id = d.source.slice('pattern '.length).split('@')[0];
    return selected.some((p) => p.id === id) || !catalog.patterns.some((p) => p.id === id);
  });
  return {
    errors: relevant.filter((d) => d.level === 'error'),
    warnings: relevant.filter((d) => d.level === 'warning'),
    patterns: selected.length,
  };
}
