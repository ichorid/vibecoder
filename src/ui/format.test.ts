import { describe, expect, it } from 'vitest';
import { describeLevel, formatActiveTime, formatAmount } from './format';

describe('format helpers', () => {
  it('formats active time', () => {
    expect(formatActiveTime(0)).toBe('0:00');
    expect(formatActiveTime(61_500)).toBe('1:01');
    expect(formatActiveTime(3_725_000)).toBe('1:02:05');
  });

  it('formats compact amounts', () => {
    expect(formatAmount(999.9)).toBe('999');
    expect(formatAmount(1200)).toBe('1.2K');
    expect(formatAmount(45_600_000)).toBe('45.6M');
    expect(formatAmount(1000)).toBe('1K');
  });

  it('describes bar levels in words', () => {
    expect(describeLevel(0)).toBe('empty');
    expect(describeLevel(85)).toBe('good');
    expect(describeLevel(39)).toBe('low');
  });
});
