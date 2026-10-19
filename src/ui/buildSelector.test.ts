import { describe, expect, it } from 'vitest';
import { buildSelector } from './floatingGains';

describe('where a press of code flies', () => {
  it('into the build row of the first slot, whatever it builds', () => {
    for (const target of ['release', 'demo', 'gig', 'job', 'autocomplete']) {
      expect(buildSelector(target)).toBe('[data-build-slot="0"]');
    }
    expect(buildSelector(null)).toBeNull();
  });
});
