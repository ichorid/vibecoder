import { describe, expect, it } from 'vitest';
import { ROOM_ADDITION, worldAdditions } from '../content/world';
import { leanToward, planSites, revealedRect, SITE_COLOR } from './sites';

const site = (over: Partial<Parameters<typeof planSites>[0][number]> = {}) => ({
  kind: 'addition' as const,
  id: worldAdditions[1]?.id ?? '',
  progress: 0.4,
  active: true,
  half: false,
  framed: false,
  ...over,
});

describe('construction sites', () => {
  it('a technology site is a silhouette of that addition, keyed by kind and ID', () => {
    const [plan] = planSites([site()], []);
    expect(plan?.key).toBe(`addition:${worldAdditions[1]?.id}`);
    expect(plan?.placements).toEqual(worldAdditions[1]?.placements);
  });

  it('the next release is a frame being assembled on the room wall', () => {
    const [plan] = planSites([site({ kind: 'frame', id: '2' })], []);
    const slot = ROOM_ADDITION.frameSlots?.[1];
    expect(plan?.placements).toEqual([{ sprite: 'release-frame', x: slot?.x, y: slot?.y }]);
    // Past the last wall spot there is nowhere to hang it: no site.
    expect(planSites([site({ kind: 'frame', id: '99' })], [])).toEqual([]);
  });

  it("the system's own project is a generic site next to the newest addition", () => {
    const [plan] = planSites([site({ kind: 'internal', id: 'rewrite-in-rust' })], ['autocomplete']);
    expect(plan?.placements).toEqual([]);
    const newest = worldAdditions.find((a) => a.technologyId === 'autocomplete');
    expect(plan?.at.x).toBeGreaterThan(newest?.anchor.x ?? 0);
  });

  it('scaffolding grows bottom-up with progress', () => {
    const bounds = { x: 0, y: 0, w: 10, h: 20 };
    expect(revealedRect(bounds, 0)).toEqual({ x: 0, y: 20, w: 10, h: 0 });
    expect(revealedRect(bounds, 0.25)).toEqual({ x: 0, y: 15, w: 10, h: 5 });
    expect(revealedRect(bounds, 2)).toEqual(bounds);
  });

  it('the camera leans halfway toward a framed site', () => {
    const base = { centerX: 0, centerY: 0, zoom: 4 };
    const wide = { centerX: 10, centerY: -10, zoom: 1 };
    expect(leanToward(base, wide)).toEqual({ centerX: 5, centerY: -5, zoom: 2 });
  });

  it('sites are hazard yellow, never the orange of the cat', () => {
    const [r, g, b] = [(SITE_COLOR >> 16) & 255, (SITE_COLOR >> 8) & 255, SITE_COLOR & 255];
    // Orange has green well below red; hazard yellow keeps green close to red.
    expect(g / r).toBeGreaterThan(0.75);
    expect(b).toBeLessThan(120);
  });
});
