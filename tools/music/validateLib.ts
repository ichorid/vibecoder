/** `music:validate` logic: catalog + semantics + bank similarity for a corpus, optionally one era. */
import { buildCatalog, type Diagnostic } from '../../src/music/core/catalog';
import { compareBank } from '../../src/music/core/similarity';
import { analyzePattern, type NormalizedPattern } from '../../src/music/core/validation';
import { readRepository } from './sources';

export interface ValidationReport {
  readonly errors: readonly Diagnostic[];
  readonly warnings: readonly Diagnostic[];
  readonly patterns: number;
}

const idOf = (key: string) => key.split('@')[0];

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
    ...diagnostics,
  ];
  const selected = catalog.patterns.filter((p) => era === undefined || p.eraId === era);
  const banks = new Map<string, NormalizedPattern[]>();
  for (const pattern of selected) {
    const analysis = analyzePattern(pattern, catalog);
    all.push(...analysis.diagnostics);
    if (analysis.normalized) {
      banks.set(pattern.eraId, [...(banks.get(pattern.eraId) ?? []), analysis.normalized]);
    }
  }
  for (const [eraId, bank] of [...banks.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    for (const finding of compareBank(bank)) {
      // Two IDs with identical music are an error; a revision identical to its predecessor and
      // near variants are for a human to judge.
      const sameId = idOf(finding.a) === idOf(finding.b);
      const level = finding.kind === 'exact' && !sameId ? 'error' : 'warning';
      all.push({
        level,
        source: `pattern ${finding.b}`,
        path: '/tracks',
        message: `pattern ${finding.b} (${eraId}): ${finding.a} → ${finding.b} ${finding.reason}`,
      });
    }
  }
  const relevant = all.filter((d) => {
    if (era === undefined || !d.source.startsWith('pattern ')) return true;
    const id = idOf(d.source.slice('pattern '.length));
    return selected.some((p) => p.id === id) || !catalog.patterns.some((p) => p.id === id);
  });
  return {
    errors: relevant.filter((d) => d.level === 'error'),
    warnings: relevant.filter((d) => d.level === 'warning'),
    patterns: selected.length,
  };
}
