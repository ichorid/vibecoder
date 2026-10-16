import { describe, expect, it } from 'vitest';
import { importCandidateText } from '../../src/music-lab/candidates';
import { decodeReviewEnvelope } from '../../src/music-lab/reviews';
import { LIMITS } from '../../src/music/core/schema';
import { readRepository } from '../../tools/music/sources';

const installed = readRepository('music');

describe('import limits (one place, checked before expensive work)', () => {
  it('a flood of tiny invalid patterns is refused by count, quickly', () => {
    const flood = JSON.stringify(Array.from({ length: 40_000 }, (_, i) => ({ id: `x${i}` })));
    expect(flood.length).toBeLessThan(LIMITS.batchBytes);
    const started = performance.now();
    const result = importCandidateText(flood, 'flood.json', installed, []);
    expect(performance.now() - started).toBeLessThan(500);
    expect(result.candidates).toEqual([]);
    expect(result.report.rejected[0]?.problems.join()).toMatch(/at most \d+ patterns/);
  });

  it('a review file with too many records is refused before validating them', () => {
    const record = {
      schemaVersion: 1,
      patternId: 'a',
      revision: 1,
      contentHash: 'a'.repeat(64),
      status: 'approved',
    };
    const text = JSON.stringify({
      schemaVersion: 1,
      kind: 'vibe-coder-music-reviews',
      records: Array.from({ length: LIMITS.reviewsPerBatch + 1 }, () => record),
    });
    const started = performance.now();
    const result = decodeReviewEnvelope(text);
    expect(performance.now() - started).toBeLessThan(500);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at most \d+ records/);
  });

  it('nothing in an imported file is executed or fetched: unknown fields are schema errors', () => {
    const demo = installed.patterns[0] as Record<string, unknown>;
    const sneaky = { ...demo, id: 'sneaky', onload: 'alert(1)', url: 'https://example.com/x.js' };
    const result = importCandidateText(JSON.stringify(sneaky), 'sneaky.json', installed, []);
    expect(result.candidates).toEqual([]);
    expect(result.report.rejected[0]?.problems.join()).toMatch(/additional properties/);
  });
});
