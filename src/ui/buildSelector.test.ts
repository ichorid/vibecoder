import { describe, expect, it } from 'vitest';
import { buildSelector } from './floatingGains';

describe('where a press of code flies', () => {
  it('into the card or strip of the first slot’s build', () => {
    expect(buildSelector('release')).toBe('[data-testid="ship-build"]');
    expect(buildSelector('demo')).toBe('[data-testid="demo-build"]');
    expect(buildSelector('gig')).toBe('[data-testid="gig"]');
    expect(buildSelector('job')).toBe('[data-testid="job-card"]');
    expect(buildSelector('autocomplete')).toBe('[data-offer="autocomplete"]');
    expect(buildSelector(null)).toBeNull();
  });
});
