import { describe, expect, it } from 'vitest';
import { clockFor, durationSeconds, tempoAllowed } from '../../src/music/core/timing';

const fourFour = { numerator: 4, denominator: 4 };

describe('music timing', () => {
  it('gives 48 ticks per step, 3072 ticks and 8 s per default phrase', () => {
    const clock = clockFor({
      ppq: 192,
      timeSignature: fourFour,
      stepsPerBar: 16,
      bars: 4,
      bpm: 120,
    });
    expect(clock).toMatchObject({
      ok: true,
      ticksPerStep: 48,
      ticksPerBar: 768,
      phraseTicks: 3072,
    });
    expect(clock.ok && clock.seconds).toBe(8);
  });

  it('counts quarter notes correctly in 3/4 and 6/8', () => {
    const waltz = clockFor({
      ppq: 192,
      timeSignature: { numerator: 3, denominator: 4 },
      stepsPerBar: 12,
      bars: 4,
      bpm: 120,
    });
    expect(waltz.ok && waltz.ticksPerBar).toBe(576);
    const compound = clockFor({
      ppq: 192,
      timeSignature: { numerator: 6, denominator: 8 },
      stepsPerBar: 12,
      bars: 2,
      bpm: 90,
    });
    expect(compound.ok && compound.ticksPerBar).toBe(576);
    expect(durationSeconds(2, { numerator: 6, denominator: 8 }, 90)).toBeCloseTo(4, 9);
  });

  it('rejects a grid that cannot be represented in whole ticks instead of rounding', () => {
    const odd = clockFor({ ppq: 192, timeSignature: fourFour, stepsPerBar: 7, bars: 4, bpm: 120 });
    expect(odd.ok).toBe(false);
    expect(!odd.ok && odd.error).toMatch(/whole ticks/);
  });

  it('allows a note ending exactly on the phrase boundary', () => {
    const clock = clockFor({
      ppq: 192,
      timeSignature: fourFour,
      stepsPerBar: 16,
      bars: 4,
      bpm: 120,
    });
    if (!clock.ok) throw new Error('clock');
    expect((60 + 4) * clock.ticksPerStep).toBe(clock.phraseTicks);
  });

  it('allows tempo overrides only where the clock policy does', () => {
    expect(tempoAllowed('single-audition', 90, 120)).toBe(true);
    expect(tempoAllowed('bank', 90, 120)).toBe(false);
    expect(tempoAllowed('bank', 120, 120)).toBe(true);
    expect(tempoAllowed('era-boundary', 90, 120)).toBe(true);
  });
});
