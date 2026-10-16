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

/** Settings: a gear with eight teeth around a round hole. */
export const settingsCog: PixelMap = {
  rows: [
    '.....kkk.....',
    '.kk..kkk..kk.',
    '.kkkkkkkkkkk.',
    '..kkkkkkkkk..',
    '..kkk...kkk..',
    'kkkk.....kkkk',
    'kkkk.....kkkk',
    'kkkk.....kkkk',
    '..kkk...kkk..',
    '..kkkkkkkkk..',
    '.kkkkkkkkkkk.',
    '.kk..kkk..kk.',
    '.....kkk.....',
  ],
  palette: { k: 'var(--ink)' },
};

/** The cat died: a small memorial candle, burning. */
export const catCandle: PixelMap = {
  rows: [
    '.....y......',
    '....yoy.....',
    '....yoy.....',
    '.....r......',
    '....kwk.....',
    '....kwk.....',
    '....kwk.....',
    '....kwk.....',
    '..kkkkkkk...',
    '.kmmmmmmmk..',
    '..kkkkkkk...',
  ],
  palette: { y: '#f6c945', o: '#fff4c2', r: '#e8892f', k: '#2a2017', w: '#f3ead2', m: '#b7b3a9' },
};

/** The cat left as a stray: the sun going down over the horizon. */
export const catSunset: PixelMap = {
  rows: [
    'pppppppppppp',
    'ppppyyyypppp',
    'ppyyyyyyyypp',
    'pyyyyyyyyyyp',
    'oooooooooooo',
    'rrorrrrrorrr',
    'vvvvrvvvvvvv',
    'vvvvvvvvrvvv',
    'vvvvvvvvvvvv',
  ],
  palette: { p: '#f5a3a0', y: '#f6c945', o: '#e8892f', r: '#f2b46a', v: '#7a68e6' },
};

const CAT_PALETTE = {
  o: '#e8892f',
  s: '#c96f1e',
  d: '#2a2017',
  p: '#f2a3a3',
  w: '#fbe3c4',
  g: '#9fb36a',
};

/** Large sitting cat for the Cat view (temporary until the P06 atlas). */
export const catSitting: PixelMap = {
  rows: [
    '..o.......o.........',
    '..oo.....oo.........',
    '..ooooooooo.........',
    '..odooooodo.........',
    '..ooooppooo.........',
    '..wooowwoow.........',
    '...ooooooo..........',
    '...ososooo......oo..',
    '..ooooooooo.....o...',
    '..oosoosoooo...oo...',
    '.ooooooooooo..oo....',
    '.ooososoooooooo.....',
    '.oooooooooooo.......',
    '.wwoooooooww........',
    '.ww......ww.........',
  ],
  palette: CAT_PALETTE,
};

/** Overfed variant: visibly rounder body. */
export const catRound: PixelMap = {
  rows: [
    '...o.......o........',
    '...oo.....oo........',
    '...ooooooooo........',
    '...odooooodo........',
    '...ooooppooo........',
    '...wooowwoow........',
    '..ooooooooooo.......',
    '.ooososoooooooo..oo.',
    'oooooooooooooooo.o..',
    'oooosoosooooooooo...',
    'oooooooooooooooo....',
    'ooooososooooooo.....',
    '.oooooooooooooo.....',
    '..wwoooooooww.......',
    '..ww.......ww.......',
  ],
  palette: CAT_PALETTE,
};

const PHOTO_PALETTE = {
  ...CAT_PALETTE,
  k: '#3b3f4a',
  l: '#6c7486',
  m: '#9bb7d4',
  b: '#5a3a22',
  h: '#46536b',
  f: '#f1c69a',
  y: '#e9d9b4',
};

/** Memorial photo 1 (temporary art): the cat asleep on the keyboard beside the programmer. */
export const memorialKeyboard: PixelMap = {
  rows: [
    'yyyyyyyyyyyyyyyyyyyyyyyy',
    'yyyyyyyyyykkkkkkkkkyyyyy',
    'yyyyyyyyyykmmmmmmmkyyyyy',
    'yybbbyyyyykmmmmmmmkyyyyy',
    'ybfffbyyyykmmmmmmmkyyyyy',
    'yyfffyyyyykkkkkkkkkyyyyy',
    'yhhhhhyyyyyyyykyyyyyyyyy',
    'hhhhhhhyyyyyyykyyyyyyyyy',
    'hhhhhhhhllllllllllllllly',
    'hhhhhhhhlooooooolllllly',
    'hhhhhhhhooooooooooollly',
    'hhhhhhhhlowoowoooolllly',
    'hhhhhhhhllllllllllllllly',
  ],
  palette: PHOTO_PALETTE,
};

/** Memorial photo 2 (temporary art): the cat curled up on the programmer's lap. */
export const memorialLap: PixelMap = {
  rows: [
    'yyyyyyyyyyyyyyyyyyyyyyyy',
    'yyyyyyyybbbbbyyyyyyyyyyy',
    'yyyyyyybfffffbyyyyyyyyyy',
    'yyyyyyyyfdfdfyyyyyyyyyyy',
    'yyyyyyyyfffffyyyyyyyyyyy',
    'yyyyyhhhhhhhhhhhyyyyyyyy',
    'yyyyhhhhhhhhhhhhhyyyyyyy',
    'yyyhhhho.....ohhhhyyyyyy',
    'yyyhhhoooooooooohhhyyyyy',
    'yyyhhoodoooooooohhhyyyyy',
    'yyyhhooooooooooohhhyyyyy',
    'yyyyhhhoooooooohhhyyyyyy',
    'yyyyyhhhhhhhhhhhhyyyyyyy',
  ],
  palette: PHOTO_PALETTE,
};
