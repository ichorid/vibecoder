import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createCanvas } from './canvas';
import { encodePng, readPngSize } from './png';

describe('PNG encoder', () => {
  it('writes a valid RGBA PNG whose pixels decode back', () => {
    const canvas = createCanvas(3, 2);
    canvas.set(0, 0, [255, 0, 0, 255]);
    canvas.set(2, 1, [0, 0, 255, 128]);
    const png = encodePng(canvas);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(readPngSize(png)).toEqual({ width: 3, height: 2 });
    const idatStart = png.indexOf(Buffer.from('IDAT')) + 4;
    const length = png.readUInt32BE(idatStart - 8);
    const raw = inflateSync(png.subarray(idatStart, idatStart + length));
    // Each row: filter byte 0 + 3 RGBA pixels.
    expect(raw.length).toBe(2 * (1 + 3 * 4));
    expect([...raw.subarray(1, 5)]).toEqual([255, 0, 0, 255]);
    expect([...raw.subarray(13 + 1 + 8, 13 + 1 + 12)]).toEqual([0, 0, 255, 128]);
  });

  it('is deterministic byte for byte', () => {
    const a = createCanvas(4, 4);
    a.rect(1, 1, 2, 2, [10, 20, 30, 255]);
    const b = createCanvas(4, 4);
    b.rect(1, 1, 2, 2, [10, 20, 30, 255]);
    expect(encodePng(a).equals(encodePng(b))).toBe(true);
  });

  it('rejects a buffer that is not a PNG', () => {
    expect(() => readPngSize(Buffer.from('nope, not a png at all'))).toThrow(/PNG/);
  });
});
