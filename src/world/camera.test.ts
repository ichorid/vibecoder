import { describe, expect, it } from 'vitest';
import { ROOM_ADDITION, sceneEnvelope, worldAdditions } from '../content/world';
import { easeInOut, fitEnvelope, hugBounds, interpolateCamera, worldToScreen } from './camera';

const viewport = { width: 390, height: 560 };
const ids = worldAdditions.flatMap((a) => (a.technologyId ? [a.technologyId] : []));

function contains(
  outer: { x: number; y: number; w: number; h: number },
  inner: typeof outer,
): boolean {
  return (
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.w >= inner.x + inner.w &&
    outer.y + outer.h >= inner.y + inner.h
  );
}

describe('scene definitions', () => {
  it('keeps the original room at the origin', () => {
    const back = ROOM_ADDITION.placements.find((p) => p.sprite === 'room-back');
    expect(back).toBeDefined();
    expect((back?.x ?? 0) + 88).toBe(0);
    expect((back?.y ?? 0) + 64).toBe(0);
  });

  it('has unique addition IDs and links between existing nodes', () => {
    const all = [ROOM_ADDITION, ...worldAdditions];
    expect(new Set(all.map((a) => a.id)).size).toBe(all.length);
    for (const addition of worldAdditions) {
      for (const link of addition.links) {
        expect(all.some((a) => a.id === link.to)).toBe(true);
      }
    }
  });

  it('strictly expands the framing envelope with every unlock', () => {
    let previous = sceneEnvelope([]);
    for (let i = 1; i <= ids.length; i += 1) {
      const next = sceneEnvelope(ids.slice(0, i));
      expect(contains(next, previous)).toBe(true);
      expect(next.w * next.h).toBeGreaterThan(previous.w * previous.h);
      previous = next;
    }
  });
});

describe('camera math', () => {
  it('fits the envelope inside a portrait canvas and zooms out as it grows', () => {
    let lastZoom = Infinity;
    for (let i = 0; i <= ids.length; i += 1) {
      const env = sceneEnvelope(ids.slice(0, i));
      const camera = fitEnvelope(env, viewport);
      const topLeft = worldToScreen({ x: env.x, y: env.y }, camera, viewport);
      const bottomRight = worldToScreen({ x: env.x + env.w, y: env.y + env.h }, camera, viewport);
      expect(topLeft.x).toBeGreaterThanOrEqual(-1e-6);
      expect(topLeft.y).toBeGreaterThanOrEqual(-1e-6);
      expect(bottomRight.x).toBeLessThanOrEqual(viewport.width + 1e-6);
      expect(bottomRight.y).toBeLessThanOrEqual(viewport.height + 1e-6);
      expect(camera.zoom).toBeLessThan(lastZoom);
      lastZoom = camera.zoom;
    }
  });

  it('refits the same envelope on resize without changing what is unlocked', () => {
    const env = sceneEnvelope(ids.slice(0, 2));
    const narrow = fitEnvelope(env, { width: 320, height: 400 });
    const wide = fitEnvelope(env, { width: 430, height: 700 });
    expect(narrow.centerX).toBe(wide.centerX);
    expect(narrow.zoom).toBeLessThan(wide.zoom);
    expect(sceneEnvelope(ids.slice(0, 2))).toEqual(env);
  });

  it('interpolates with one easing between two framings', () => {
    const a = { centerX: 0, centerY: 0, zoom: 2 };
    const b = { centerX: 100, centerY: -50, zoom: 0.5 };
    expect(interpolateCamera(a, b, 0)).toEqual(a);
    expect(interpolateCamera(a, b, 1)).toEqual(b);
    const mid = interpolateCamera(a, b, 0.5);
    expect(mid.centerX).toBeCloseTo(50, 6);
    expect(mid.zoom).toBeCloseTo(1, 6);
    expect(easeInOut(0.25)).toBeLessThan(0.25);
    expect(easeInOut(0.75)).toBeGreaterThan(0.75);
  });

  it('maps world to screen with screen = (world - center) × zoom + viewportCenter', () => {
    const camera = { centerX: 10, centerY: 20, zoom: 2 };
    expect(worldToScreen({ x: 10, y: 20 }, camera, viewport)).toEqual({ x: 195, y: 280 });
    expect(worldToScreen({ x: 15, y: 20 }, camera, viewport)).toEqual({ x: 205, y: 280 });
  });
});

describe('hugging the scene', () => {
  it('frames the union of what is drawn with a small margin', () => {
    const box = hugBounds([
      { x: 0, y: 0, w: 100, h: 50 },
      { x: 80, y: -50, w: 40, h: 20 },
    ]);
    const expected = { x: -9.6, y: -58, w: 139.2, h: 116 };
    for (const key of ['x', 'y', 'w', 'h'] as const)
      expect(box?.[key]).toBeCloseTo(expected[key], 9);
    expect(hugBounds([])).toBeNull();
  });

  it('fills a wide viewport instead of letterboxing a portrait envelope', () => {
    const viewport = { width: 400, height: 250 };
    const room = { x: -88, y: -64, w: 176, h: 128 };
    const hugged = fitEnvelope(hugBounds([room]) ?? room, viewport);
    const portrait = fitEnvelope({ x: -102, y: -136, w: 204, h: 272 }, viewport);
    expect(hugged.zoom).toBeGreaterThan(portrait.zoom * 1.5);
  });
});
