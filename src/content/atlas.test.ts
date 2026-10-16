import { describe, expect, it } from 'vitest';
import { toPixiSheet, validateAtlas, domAnimation, type AtlasData } from './atlas';

function atlas(overrides: Partial<AtlasData> = {}): AtlasData {
  return {
    format: 'vibe-atlas/1',
    image: 'sprites-light.png',
    size: { w: 64, h: 32 },
    frames: {
      'cat-idle-0': { x: 0, y: 0, w: 20, h: 16 },
      'cat-idle-1': { x: 20, y: 0, w: 20, h: 16 },
    },
    animations: { 'cat-idle': { frames: ['cat-idle-0', 'cat-idle-1'], frameMs: 400 } },
    ...overrides,
  };
}

const errors = (value: unknown, size = { width: 64, height: 32 }) =>
  validateAtlas(value, size).join('\n');

describe('atlas contract', () => {
  it('accepts a valid atlas', () => {
    expect(validateAtlas(atlas(), { width: 64, height: 32 })).toEqual([]);
  });

  it('rejects a wrong format', () => {
    expect(errors({ ...atlas(), format: 'aseprite' })).toMatch(/format/);
  });

  it('rejects a missing frame referenced by a tag', () => {
    expect(
      errors(
        atlas({
          animations: { 'cat-idle': { frames: ['cat-idle-0', 'cat-idle-9'], frameMs: 400 } },
        }),
      ),
    ).toMatch(/unknown frame "cat-idle-9"/);
  });

  it('rejects a non-positive frame duration', () => {
    expect(
      errors(atlas({ animations: { 'cat-idle': { frames: ['cat-idle-0'], frameMs: 0 } } })),
    ).toMatch(/duration/);
  });

  it('rejects a rectangle outside the texture or a size mismatch with the PNG', () => {
    expect(
      errors(atlas({ frames: { 'cat-idle-0': { x: 50, y: 0, w: 20, h: 16 } }, animations: {} })),
    ).toMatch(/outside/);
    expect(errors(atlas(), { width: 32, height: 32 })).toMatch(/PNG is 32×32/);
  });

  it('rejects a missing image file', () => {
    expect(validateAtlas(atlas(), null).join('\n')).toMatch(/missing image/);
  });

  it('gives Pixi and the DOM the same frames for one tag', () => {
    const data = atlas();
    const sheet = toPixiSheet(data);
    expect(sheet.animations['cat-idle']).toEqual(['cat-idle-0', 'cat-idle-1']);
    expect(sheet.frames['cat-idle-1']?.frame).toEqual({ x: 20, y: 0, w: 20, h: 16 });
    const dom = domAnimation(data, 'cat-idle');
    expect(dom.frames.map((f) => [f.x, f.y])).toEqual([
      [0, 0],
      [20, 0],
    ]);
    expect(dom.frameMs).toBe(400);
  });
});
