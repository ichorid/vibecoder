import { describe, expect, it } from 'vitest';
import { clipToBox } from './linkGeometry';

const room = { x: -88, y: -64, w: 176, h: 128 };

describe('connectors stop at the room picture', () => {
  it('a link coming from above ends on the top edge, not in the middle of the room', () => {
    expect(clipToBox({ x: 0, y: -200 }, { x: 0, y: 0 }, room)).toEqual({ x: 0, y: -64 });
  });

  it('a diagonal link ends where it first meets the border', () => {
    const p = clipToBox({ x: 200, y: -200 }, { x: 0, y: 0 }, room);
    expect(p.x).toBeCloseTo(64, 9);
    expect(p.y).toBeCloseTo(-64, 9);
  });

  it('leaves links alone when the target is outside, or the start is inside', () => {
    expect(clipToBox({ x: 0, y: -200 }, { x: 300, y: 0 }, room)).toEqual({ x: 300, y: 0 });
    expect(clipToBox({ x: 0, y: 0 }, { x: 10, y: 10 }, room)).toEqual({ x: 10, y: 10 });
  });
});
