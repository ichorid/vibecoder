import { describe, expect, it } from 'vitest';
import { catLod, clusterLod, projectedSize } from './lod';

describe('cluster LOD', () => {
  it('depends on CSS pixels, not device pixel ratio', () => {
    const size = projectedSize(40, 0.9);
    expect(clusterLod(size, null)).toBe('detail');
    // The same CSS size on a DPR-2 screen is still the same CSS size.
    expect(clusterLod(projectedSize(120, 0.9), null)).toBe(clusterLod(size, null));
  });

  it('switches detail → compact → dots at 32 and 8 CSS px', () => {
    expect(clusterLod(32, null)).toBe('detail');
    expect(clusterLod(31, null)).toBe('compact');
    expect(clusterLod(8, null)).toBe('compact');
    expect(clusterLod(7.9, null)).toBe('dots');
  });

  it('uses a 10% hysteresis band so it does not flicker at a threshold', () => {
    expect(clusterLod(29.5, 'detail')).toBe('detail');
    expect(clusterLod(28.5, 'detail')).toBe('compact');
    expect(clusterLod(34, 'compact')).toBe('compact');
    expect(clusterLod(35.5, 'compact')).toBe('detail');
    expect(clusterLod(7.5, 'compact')).toBe('compact');
    expect(clusterLod(8.5, 'dots')).toBe('dots');
    expect(clusterLod(9, 'dots')).toBe('compact');
  });
});

describe('world cat', () => {
  it('is never drawn when dead, at any zoom', () => {
    for (const px of [400, 24, 5, 1, 0.1]) expect(catLod(px, false, false, null)).toBe('hidden');
  });

  it('shrinks from sprite to an orange cluster to a single pixel', () => {
    expect(catLod(24, true, false, null)).toBe('sprite');
    expect(catLod(6, true, false, null)).toBe('cluster');
    expect(catLod(1.5, true, false, null)).toBe('pixel');
  });

  it('visually disappears at the final framing while still alive', () => {
    expect(catLod(1.5, true, true, null)).toBe('hidden');
    expect(catLod(0.2, true, false, null)).toBe('hidden');
  });
});
