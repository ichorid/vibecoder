import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../src/music/core/catalog';
import { analyzePattern } from '../../src/music/core/validation';
import type { PatternDocument } from '../../src/music/data/patterns.generated';
import { pattern, sources } from './fixtures';

function analyze(overrides: Record<string, unknown>) {
  const doc = pattern(overrides) as unknown as PatternDocument;
  const { catalog } = buildCatalog(sources({ patterns: [] }));
  return analyzePattern(doc, catalog);
}

const lead = (...events: unknown[]) => ({ tracks: { lead: events } });
const errors = (r: ReturnType<typeof analyze>) =>
  r.diagnostics
    .filter((d) => d.level === 'error')
    .map((d) => d.message)
    .join('\n');
const warnings = (r: ReturnType<typeof analyze>) =>
  r.diagnostics
    .filter((d) => d.level === 'warning')
    .map((d) => d.message)
    .join('\n');

describe('musical semantics', () => {
  it('accepts a clean pattern', () => {
    expect(analyze({}).diagnostics).toEqual([]);
  });

  it('rejects an unknown chord or mode', () => {
    expect(errors(analyze({ harmony: [{ step: 0, length: 64, chord: 'Cblorp' }] }))).toMatch(
      /chord/,
    );
    expect(errors(analyze({ key: { tonic: 'C', mode: 'zigzag' } }))).toMatch(/mode/);
  });

  it('rejects a pitch outside the role’s preset range', () => {
    expect(errors(analyze(lead({ type: 'note', step: 0, length: 4, pitch: 'C2' })))).toMatch(
      /range/,
    );
  });

  it('rejects overlapping notes on a monophonic role, allows touching ones', () => {
    const overlap = lead(
      { type: 'note', step: 0, length: 4, pitch: 'C5' },
      { type: 'note', step: 2, length: 4, pitch: 'E5' },
    );
    expect(errors(analyze(overlap))).toMatch(/polyphony|overlap/);
    const touching = lead(
      { type: 'note', step: 0, length: 4, pitch: 'C5' },
      { type: 'note', step: 4, length: 4, pitch: 'E5' },
    );
    expect(errors(analyze(touching))).toBe('');
  });

  it('does not count velocity 0 events as voices', () => {
    const silent = lead(
      { type: 'note', step: 0, length: 4, pitch: 'C5' },
      { type: 'note', step: 0, length: 4, pitch: 'E5', velocity: 0 },
    );
    expect(errors(analyze(silent))).toBe('');
  });

  it('rejects an event that crosses the pattern end, allows ending exactly on it', () => {
    expect(errors(analyze(lead({ type: 'note', step: 62, length: 4, pitch: 'C5' })))).toMatch(
      /end|bounds/,
    );
    expect(errors(analyze(lead({ type: 'note', step: 60, length: 4, pitch: 'C5' })))).toBe('');
  });

  it('rejects overlapping or gapped harmony spans', () => {
    expect(
      errors(
        analyze({
          harmony: [
            { step: 0, length: 40, chord: 'C' },
            { step: 32, length: 32, chord: 'G' },
          ],
        }),
      ),
    ).toMatch(/harmony/);
    expect(errors(analyze({ harmony: [{ step: 0, length: 32, chord: 'C' }] }))).toMatch(/harmony/);
  });

  it('warns (does not fail) for a passing non-chord tone and chromaticism', () => {
    const passing = analyze(lead({ type: 'note', step: 0, length: 2, pitch: 'D5' }));
    expect(errors(passing)).toBe('');
    expect(warnings(passing)).toMatch(/non-chord/);
    const chromatic = analyze(lead({ type: 'note', step: 0, length: 2, pitch: 'F#5' }));
    expect(errors(chromatic)).toBe('');
    expect(warnings(chromatic)).toMatch(/outside the key|chromatic/);
  });

  it('normalizes defaults from the era', () => {
    const result = analyze({});
    expect(result.normalized).toMatchObject({ bpm: 120, stepsPerBar: 16, totalSteps: 64 });
  });
});
