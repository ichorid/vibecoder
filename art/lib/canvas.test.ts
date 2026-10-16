import { describe, expect, it } from 'vitest';
import { createCanvas, parseColor } from './canvas';

describe('pixel canvas', () => {
  it('clips drawing to its bounds and blends nothing (hard pixels)', () => {
    const c = createCanvas(4, 4);
    c.rect(-2, -2, 4, 4, '#ff0000');
    expect(c.get(0, 0)).toEqual([255, 0, 0, 255]);
    expect(c.get(2, 2)).toEqual([0, 0, 0, 0]);
  });

  it('draws pixel maps with a palette and transparent dots', () => {
    const c = createCanvas(3, 2);
    c.map(['a.a', '.a.'], { a: '#00ff00' }, 0, 0);
    expect(c.get(0, 0)).toEqual([0, 255, 0, 255]);
    expect(c.get(1, 0)).toEqual([0, 0, 0, 0]);
    expect(c.get(1, 1)).toEqual([0, 255, 0, 255]);
  });

  it('parses hex colors with optional alpha', () => {
    expect(parseColor('#102030')).toEqual([16, 32, 48, 255]);
    expect(parseColor('#10203080')).toEqual([16, 32, 48, 128]);
  });

  it('draws straight lines including both endpoints', () => {
    const c = createCanvas(5, 5);
    c.line(0, 0, 4, 4, '#ffffff');
    for (let i = 0; i < 5; i += 1) expect(c.get(i, i)[3]).toBe(255);
    expect(c.get(1, 0)[3]).toBe(0);
  });

  it('copies a region into another canvas', () => {
    const src = createCanvas(2, 2);
    src.rect(0, 0, 2, 2, '#abcdef');
    const dst = createCanvas(4, 4);
    dst.blit(src, 2, 2);
    expect(dst.get(3, 3)).toEqual([171, 205, 239, 255]);
    expect(dst.get(1, 1)).toEqual([0, 0, 0, 0]);
  });
});

describe('shape helpers', () => {
  it('fills an ellipse symmetrically', async () => {
    const { ellipse } = await import('./shapes');
    const c = createCanvas(11, 7);
    ellipse(c, 5, 3, 5, 3, '#ffffff');
    expect(c.get(5, 3)[3]).toBe(255);
    expect(c.get(0, 3)[3]).toBe(255);
    expect(c.get(10, 3)[3]).toBe(255);
    expect(c.get(0, 0)[3]).toBe(0);
  });

  it('outlines every transparent pixel touching a filled one, but not diagonals', async () => {
    const { outline } = await import('./shapes');
    const c = createCanvas(5, 5);
    c.set(2, 2, '#ffffff');
    outline(c, '#000000');
    expect(c.get(2, 1)).toEqual([0, 0, 0, 255]);
    expect(c.get(1, 2)).toEqual([0, 0, 0, 255]);
    expect(c.get(1, 1)[3]).toBe(0);
    expect(c.get(2, 2)).toEqual([255, 255, 255, 255]);
  });

  it('fills a triangle including its vertices', async () => {
    const { triangle } = await import('./shapes');
    const c = createCanvas(6, 6);
    triangle(c, [0, 5], [5, 5], [2, 0], '#ff00ff');
    expect(c.get(0, 5)[3]).toBe(255);
    expect(c.get(5, 5)[3]).toBe(255);
    expect(c.get(2, 0)[3]).toBe(255);
    expect(c.get(5, 0)[3]).toBe(0);
  });

  it('renders text with the 3×5 font', async () => {
    const { text, textWidth } = await import('./font');
    const c = createCanvas(20, 6);
    text(c, 'HI', 0, 0, '#ffffff');
    expect(textWidth('HI')).toBe(7);
    expect(c.get(0, 0)[3]).toBe(255);
  });
});
