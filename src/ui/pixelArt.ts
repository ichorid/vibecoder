/**
 * Tiny inline pixel icons for DOM UI (header, buttons). Each map row is a string; characters
 * index a palette of CSS colors/variables; '.' is transparent. World and illustration art use
 * the exported atlas instead.
 */
export interface PixelMap {
  readonly rows: readonly string[];
  readonly palette: Readonly<Record<string, string>>;
}

export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly color: string;
}

/** Merge horizontal runs so an icon renders with few SVG rects. */
export function pixelRects(map: PixelMap): PixelRect[] {
  const rects: PixelRect[] = [];
  map.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x] ?? '.';
      const color = map.palette[key];
      let w = 1;
      while (row[x + w] === key) w += 1;
      if (key !== '.' && color) rects.push({ x, y, w, color });
      x += w;
    }
  });
  return rects;
}

export const catFace: PixelMap = {
  rows: [
    'o..........o',
    'oo........oo',
    'ooo......ooo',
    'oooooooooooo',
    'oodooooooodo',
    'oooooppooooo',
    'woooowwoooow',
    '.woooooooow.',
    '..oooooooo..',
  ],
  palette: { o: '#e8892f', d: '#2a2017', p: '#f2a3a3', w: '#fbe3c4' },
};

export const catFaceGone: PixelMap = {
  rows: [
    'g..........g',
    'gg........gg',
    'ggg......ggg',
    'gggggggggggg',
    'ggxgggggggxg',
    'gggggggggggg',
    'gggggxxggggg',
    '.gggggggggg.',
    '..gggggggg..',
  ],
  palette: { g: '#8f8a80', x: '#4a463f' },
};
