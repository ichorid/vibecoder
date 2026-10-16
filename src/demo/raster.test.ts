import { describe, expect, it } from 'vitest';
import { hornScript } from './emit';
import type { Genome } from './genome';
import { firstDemo } from './judge';
import { createDemoCanvas, drawDemo } from './raster';
import { paletteRgba, PALETTES } from './palettes';
import { SHAPES, spriteFor } from './sprites';

const formPixels = (buf: Uint8Array) => buf.reduce((n, v) => n + (v >= 2 && v !== 17 ? 1 : 0), 0);

describe('demo rasterizer', () => {
  it('draws the same picture for the same genome and time', () => {
    const g = firstDemo(5).genome;
    const a = createDemoCanvas(g),
      b = createDemoCanvas(g);
    drawDemo(a, 4.2);
    drawDemo(b, 4.2);
    expect(a.buf).toEqual(b.buf);
    expect(a.rgba).toEqual(b.rgba);
  });

  it('a solid radial demo fills a fair part of the screen in both styles', () => {
    const radial = Array.from({ length: 40 }, (_, i) => firstDemo(i + 1).genome).find(
      (g) => g.layout === 'radial' && !JSON.stringify(g).includes('"dots"'),
    );
    if (!radial) throw new Error('no solid radial demo in 40 seeds');
    for (const style of ['bobs', 'wire'] as const) {
      const g: Genome = { ...radial, style, trails: 0 };
      const c = createDemoCanvas(g);
      drawDemo(c, 3);
      const share = formPixels(c.buf) / c.buf.length;
      expect(share).toBeGreaterThan(style === 'wire' ? 0.005 : 0.03);
      expect(share).toBeLessThan(0.75);
    }
  });

  it('trails keep old pixels for a while; without trails each frame starts clean', () => {
    const base = { ...firstDemo(21).genome, style: 'bobs' as const, backdrop: 'bars' as const };
    const count = (trails: Genome['trails'], allow: boolean) => {
      const c = createDemoCanvas({ ...base, trails });
      for (let f = 0; f < 6; f++) drawDemo(c, 2 + f * 0.3, { trails: allow });
      return formPixels(c.buf);
    };
    expect(count(3, true)).toBeGreaterThan(count(0, true));
    expect(count(3, false)).toBe(count(0, true)); // reduced motion turns trails off
  });

  it('every shape draws, and shapes that are not round turn along their tube', () => {
    for (let shape = 0; shape < SHAPES.length; shape++) {
      const sprite = spriteFor(shape, 8, 0);
      expect(sprite.mask.reduce((a, b) => a + b, 0)).toBeGreaterThan(40);
      expect(sprite.light.some((v) => v > 0)).toBe(true);
      const turned = spriteFor(shape, 8, Math.PI / 4);
      const round = SHAPES[shape] === 'ball' || SHAPES[shape] === 'ring';
      expect(turned === sprite).toBe(round);
      expect(spriteFor(shape, 8, Math.PI / 4)).toBe(turned); // made once
    }
  });

  it('palettes are 18 opaque colours each', () => {
    for (let i = 0; i < PALETTES.length; i++) {
      const lut = paletteRgba(i);
      expect(lut).toHaveLength(18);
      expect([...lut].every((c) => c >>> 24 === 255)).toBe(true);
    }
  });

  it('the dev notation names every tube and has no NaN', () => {
    const text = hornScript(firstDemo(8).genome);
    expect(text).toMatch(/tube \w+1/);
    expect(text).toContain('render(');
    expect(text).not.toContain('NaN');
  });
});
