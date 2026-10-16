import { describe, expect, it } from 'vitest';
import { worldToScreen } from './camera';
import {
  clampView,
  IDENTITY_VIEW,
  isAdjusted,
  MAX_VIEW_ZOOM,
  MIN_VIEW_ZOOM,
  panBy,
  shownCamera,
  zoomAt,
} from './viewControl';

const base = { centerX: 10, centerY: -20, zoom: 2 };
const viewport = { width: 400, height: 300 };

describe('player camera control', () => {
  it('starts at the automatic framing', () => {
    expect(shownCamera(base, IDENTITY_VIEW)).toEqual(base);
    expect(isAdjusted(IDENTITY_VIEW)).toBe(false);
  });

  it('zooming keeps the point under the finger in place', () => {
    const at = { x: 300, y: 80 };
    const world = (cam: typeof base) => ({
      x: cam.centerX + (at.x - viewport.width / 2) / cam.zoom,
      y: cam.centerY + (at.y - viewport.height / 2) / cam.zoom,
    });
    const before = world(shownCamera(base, IDENTITY_VIEW));
    const view = zoomAt(IDENTITY_VIEW, base, viewport, at.x, at.y, 2.5);
    const screen = worldToScreen(before, shownCamera(base, view), viewport);
    expect(screen.x).toBeCloseTo(at.x, 6);
    expect(screen.y).toBeCloseTo(at.y, 6);
    expect(view.zoom).toBe(2.5);
    expect(isAdjusted(view)).toBe(true);
  });

  it('caps zoom in both directions', () => {
    expect(zoomAt(IDENTITY_VIEW, base, viewport, 200, 150, 100).zoom).toBe(MAX_VIEW_ZOOM);
    expect(zoomAt(IDENTITY_VIEW, base, viewport, 200, 150, 0.01).zoom).toBe(MIN_VIEW_ZOOM);
  });

  it('dragging moves the scene with the finger', () => {
    const view = panBy(IDENTITY_VIEW, base, 40, -20);
    const point = { x: 0, y: 0 };
    const before = worldToScreen(point, shownCamera(base, IDENTITY_VIEW), viewport);
    const after = worldToScreen(point, shownCamera(base, view), viewport);
    expect(after.x - before.x).toBeCloseTo(40, 9);
    expect(after.y - before.y).toBeCloseTo(-20, 9);
  });

  it('the view centre never leaves the scene', () => {
    const scene = { x: -50, y: -60, w: 100, h: 80 };
    const far = clampView({ zoom: 1, dx: 10_000, dy: -10_000 }, base, scene);
    const shown = shownCamera(base, far);
    expect(shown.centerX).toBe(50);
    expect(shown.centerY).toBe(-60);
  });
});
