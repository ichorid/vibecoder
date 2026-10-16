import { describe, expect, it } from 'vitest';
import {
  CANDIDATES_KEY,
  createCandidateStore,
  importCandidateText,
} from '../../src/music-lab/candidates';
import { readRepository } from '../../tools/music/sources';
import { pattern } from './fixtures';

const installed = readRepository('music');
const fresh = (overrides: Record<string, unknown> = {}) =>
  pattern({ id: 'my-idea', motifRef: { id: 'demo-main', revision: 1 }, ...overrides });

describe('local candidate patterns', () => {
  it('imports a valid pattern (single object or array) as a new local candidate', () => {
    const one = importCandidateText(JSON.stringify(fresh()), 'idea.json', installed, []);
    expect(one.report.added).toEqual(['my-idea@1']);
    expect(one.candidates).toHaveLength(1);
    const many = importCandidateText(
      JSON.stringify([fresh({ id: 'idea-b' }), fresh({ id: 'idea-c' })]),
      'batch.json',
      installed,
      one.candidates,
    );
    expect(many.report.added).toEqual(['idea-b@1', 'idea-c@1']);
    expect(many.candidates).toHaveLength(3);
  });

  it('re-importing the same payload is idempotent', () => {
    const first = importCandidateText(JSON.stringify(fresh()), 'a.json', installed, []);
    const again = importCandidateText(
      JSON.stringify(fresh()),
      'a.json',
      installed,
      first.candidates,
    );
    expect(again.report.identical).toEqual(['my-idea@1']);
    expect(again.candidates).toHaveLength(1);
  });

  it('the same id and revision with a different payload is an explicit conflict', () => {
    const first = importCandidateText(JSON.stringify(fresh()), 'a.json', installed, []);
    const changed = fresh({ energy: 0.9 });
    const clash = importCandidateText(
      JSON.stringify(changed),
      'b.json',
      installed,
      first.candidates,
    );
    expect(clash.report.conflicts[0]).toMatchObject({ key: 'my-idea@1' });
    expect(clash.candidates).toEqual(first.candidates);
    const installedDemo = installed.patterns.find(
      (p) => (p as { id: string }).id === 'discovery-demo-a',
    ) as Record<string, unknown>;
    const overwrite = importCandidateText(
      JSON.stringify({ ...installedDemo, energy: 0.1 }),
      'demo.json',
      installed,
      [],
    );
    expect(overwrite.report.conflicts[0]?.reason).toMatch(/installed/);
    expect(overwrite.candidates).toEqual([]);
  });

  it('rejects oversized, malformed and structurally invalid files without changing anything', () => {
    const huge = importCandidateText('x'.repeat(2 * 1024 * 1024 + 1), 'big.json', installed, []);
    expect(huge.report.rejected[0]?.problems.join()).toMatch(/too large/);
    const broken = importCandidateText('{"id":', 'broken.json', installed, []);
    expect(broken.report.rejected[0]?.problems.join()).toMatch(/JSON/);
    const invalid = importCandidateText(
      JSON.stringify(fresh({ tracks: { lead: [{ type: 'note', step: 0, length: 4 }] } })),
      'invalid.json',
      installed,
      [],
    );
    expect(invalid.report.rejected[0]).toMatchObject({ file: 'invalid.json' });
    expect(invalid.report.rejected[0]?.problems.join()).toMatch(/pitch/);
    const unknownEra = importCandidateText(
      JSON.stringify(fresh({ eraId: 'nowhere' })),
      'era.json',
      installed,
      [],
    );
    expect(unknownEra.report.rejected[0]?.problems.join()).toMatch(/unknown era/);
    for (const r of [huge, broken, invalid, unknownEra]) expect(r.candidates).toEqual([]);
  });

  it('persists separately and reports a full quota without losing the stored list', () => {
    const data = new Map<string, string>();
    let full = false;
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (full) throw new DOMException('quota', 'QuotaExceededError');
        data.set(k, v);
      },
    };
    const store = createCandidateStore(storage);
    expect(store.save([fresh()])).toEqual({ ok: true });
    expect(createCandidateStore(storage).load()).toEqual({ patterns: [fresh()], error: null });
    full = true;
    const result = store.save([fresh(), fresh({ id: 'second' })]);
    expect(result.ok).toBe(false);
    expect(
      (JSON.parse(data.get(CANDIDATES_KEY) ?? '{}') as { patterns: unknown[] }).patterns,
    ).toHaveLength(1);
  });
});
