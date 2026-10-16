import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../src/music/core/catalog';
import { compareBank, comparePatterns } from '../../src/music/core/similarity';
import { analyzePattern, type NormalizedPattern } from '../../src/music/core/validation';
import { readRepository } from '../../tools/music/sources';
import { pattern, sources } from './fixtures';

const note = (step: number, pitch: string, length = 2) => ({ type: 'note', step, length, pitch });
const LEAD = [
  note(0, 'E5'),
  note(2, 'G5'),
  note(4, 'A5', 4),
  note(8, 'G5', 8),
  note(16, 'C5', 4),
  note(24, 'E5', 8),
];

function pair(list: NormalizedPattern[]): [NormalizedPattern, NormalizedPattern] {
  const [a, b] = list;
  if (!a || !b) throw new Error('expected two patterns');
  return [a, b];
}

function normalized(...docs: Record<string, unknown>[]): NormalizedPattern[] {
  const { catalog, diagnostics } = buildCatalog(sources({ patterns: docs.map((d) => pattern(d)) }));
  expect(diagnostics.filter((d) => d.level === 'error')).toEqual([]);
  return catalog.patterns.map((p) => {
    const n = analyzePattern(p, catalog).normalized;
    if (!n) throw new Error(`invalid ${p.id}`);
    return n;
  });
}

describe('pattern similarity', () => {
  it('finds exact duplicates after normalization (key order, ids and metadata ignored)', () => {
    const [a, b] = pair(
      normalized(
        { id: 'one', tracks: { lead: LEAD } },
        { id: 'two', energy: 0.9, tracks: { lead: [...LEAD].reverse() } },
      ),
    );
    expect(comparePatterns(a, b)).toMatchObject({ kind: 'exact' });
  });

  it('reports near variants with the reason', () => {
    const shifted = LEAD.map((e, i) => (i === 1 ? { ...e, pitch: 'F5' } : e));
    const [a, b] = pair(
      normalized({ id: 'one', tracks: { lead: LEAD } }, { id: 'two', tracks: { lead: shifted } }),
    );
    const result = comparePatterns(a, b);
    expect(result?.kind).toBe('near');
    expect(result?.reason).toMatch(/rhythm 1\.00.*pitch classes 0\.9\d.*contour/);
  });

  it('a shared motif with different rhythm, register and density is not a duplicate', () => {
    const { catalog } = buildCatalog(readRepository('music'));
    const bank = catalog.patterns
      .map((p) => analyzePattern(p, catalog).normalized)
      .filter((n) => n !== null);
    expect(bank).toHaveLength(4);
    expect(compareBank(bank)).toEqual([]);
  });

  it('is deterministic and sorted by pair', () => {
    const shifted = LEAD.map((e, i) => (i === 1 ? { ...e, pitch: 'F5' } : e));
    const bank = normalized(
      { id: 'c-one', tracks: { lead: LEAD } },
      { id: 'a-two', tracks: { lead: shifted } },
      { id: 'b-three', tracks: { lead: LEAD } },
    );
    const first = compareBank(bank);
    expect(compareBank([...bank].reverse())).toEqual(first);
    expect(first.map((f) => `${f.a}|${f.b}`)).toEqual([
      'a-two@1|b-three@1',
      'a-two@1|c-one@1',
      'b-three@1|c-one@1',
    ]);
    expect(first.find((f) => f.a === 'b-three@1' && f.b === 'c-one@1')?.kind).toBe('exact');
  });
});
