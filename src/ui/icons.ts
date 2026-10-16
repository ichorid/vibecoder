/**
 * Pixel icons for counters, actions and cards (generated from a design sheet; edit the
 * maps directly). Ink and panel follow the theme through CSS variables.
 */
import type { PixelMap } from './pixelArt';

export const codeIcon: PixelMap = {
  rows: [
    '.....b...',
    '..k..b.k.',
    '.k..b..k.',
    'k...b...k',
    '.k.b...k.',
    '..kb..k..',
    '...b.....',
    '.........',
    '.........',
  ],
  palette: { b: '#3d7fd9', k: 'var(--ink)' },
};

export const tokensIcon: PixelMap = {
  rows: [
    '..yyyyy..',
    '.yYYYYYy.',
    'yYkkkkkYy',
    'yYYYkYYYy',
    'yYYYkYYYy',
    'yYYYkYYYy',
    'yYYYYYYYy',
    '.yYYYYYy.',
    '..yyyyy..',
  ],
  palette: { Y: '#f6c945', k: 'var(--ink)', y: '#c99212' },
};

export const debtIcon: PixelMap = {
  rows: [
    '..k...k..',
    '...kkk...',
    'k.kkkkk.k',
    '.krrkrrk.',
    'kkrrkrrkk',
    '.krrkrrk.',
    'k.krkrk.k',
    '...kkk...',
    '.........',
  ],
  palette: { k: 'var(--ink)', r: '#d9473b' },
};

export const automationIcon: PixelMap = {
  rows: [
    '....k....',
    '.k.kkk.k.',
    '..ksssk..',
    '.kss.ssk.',
    'kks...skk',
    '.kss.ssk.',
    '..ksssk..',
    '.k.kkk.k.',
    '....k....',
  ],
  palette: { k: 'var(--ink)', s: '#9aa3b2' },
};

export const revenueIcon: PixelMap = {
  rows: [
    '....g....',
    '..ggggg..',
    '.gg.g....',
    '.gg.g....',
    '..ggggg..',
    '....g.gg.',
    '....g.gg.',
    '..ggggg..',
    '....g....',
  ],
  palette: { g: '#3fa65a' },
};

export const marginIcon: PixelMap = {
  rows: [
    '.....gggg',
    '.......gg',
    '......g.g',
    '.....g...',
    '.g..g....',
    'g.gg.....',
    '.........',
    'kkkkkkkkk',
    '.........',
  ],
  palette: { g: '#3fa65a', k: 'var(--ink)' },
};

export const writeCodeIcon: PixelMap = {
  rows: [
    '.........',
    '.........',
    'kkkkkkkkk',
    'kwkwkwkwk',
    'kkkkkkkkk',
    'kwkwkwkwk',
    'kkkkkkkkk',
    'kkwwwwwkk',
    'kkkkkkkkk',
  ],
  palette: { k: 'var(--ink)', w: 'var(--panel)' },
};

/** PROMPT: a full keyboard with the Enter key lit (type the prompt, send it). */
export const promptIcon: PixelMap = {
  rows: [
    '.................',
    'kkkkkkkkkkkkkkkkk',
    'kwkwkwkwkwkwkwkwk',
    'kkkkkkkkkkkkkkkkk',
    'kkwkwkwkwkwkwkggk',
    'kkkkkkkkkkkkkkggk',
    'kkkwwwwwwwwwkkggk',
    'kkkkkkkkkkkkkkkkk',
    '.................',
  ],
  palette: { g: '#7ee2a8', k: 'var(--ink)', w: 'var(--panel)' },
};

export const delegateIcon: PixelMap = {
  rows: [
    '......kkk',
    '.....k.kk',
    '....k..k.',
    'kkkkk....',
    '....k....',
    '....k..k.',
    '.....k.kk',
    '......kkk',
    '.........',
  ],
  palette: { k: 'var(--ink)' },
};

export const superviseIcon: PixelMap = {
  rows: [
    '.........',
    '..kkkkk..',
    '.k.....k.',
    'k..kbk..k',
    'k..bbb..k',
    'k..kbk..k',
    '.k.....k.',
    '..kkkkk..',
    '.........',
  ],
  palette: { b: '#3d7fd9', k: 'var(--ink)' },
};

export const optimizeIcon: PixelMap = {
  rows: [
    '.....kk..',
    '....kYk..',
    '...kYk...',
    '..kYYkkk.',
    '.kkkYYk..',
    '...kYk...',
    '..kYk....',
    '..kk.....',
    '.........',
  ],
  palette: { Y: '#f6c945', k: 'var(--ink)' },
};

export const observeIcon: PixelMap = {
  rows: [
    '.........',
    '.kkk.kkk.',
    'kcckkcckk',
    'kcwkkcwkk',
    'kcckkcckk',
    '.kkk.kkk.',
    '.........',
    '.........',
    '.........',
  ],
  palette: { c: '#59b7ff', k: 'var(--ink)', w: 'var(--panel)' },
};

export const computeIcon: PixelMap = {
  rows: [
    '.k.k.k.k.',
    'kkkkkkkkk',
    '.kgggggk.',
    'kkgkkkgkk',
    '.kgkgkgk.',
    'kkgkkkgkk',
    '.kgggggk.',
    'kkkkkkkkk',
    '.k.k.k.k.',
  ],
  palette: { g: '#3fa65a', k: 'var(--ink)' },
};

export const agentIcon: PixelMap = {
  rows: [
    '....k....',
    '....k....',
    '.kkkkkkk.',
    '.ksssssk.',
    'kkscscskk',
    '.ksssssk.',
    '.kskkksk.',
    '.kkkkkkk.',
    '.........',
  ],
  palette: { c: '#59b7ff', k: 'var(--ink)', s: '#9aa3b2' },
};

export const reviewIcon: PixelMap = {
  rows: [
    '.kkkk....',
    'kwwwwk...',
    'kwkwwk...',
    'kwwwwk...',
    '.kkkkk...',
    '.....kk..',
    '......kk.',
    '.......kk',
    '.........',
  ],
  palette: { k: 'var(--ink)', w: 'var(--panel)' },
};

export const buyTokensIcon: PixelMap = {
  rows: [
    '..yyyyy..',
    '.yYYYYYy.',
    '..yyyyy..',
    '.yYYYYYy.',
    '..yyyyy..',
    '.yYYYYYy.',
    '..yyyyy..',
    '.yYYYYYy.',
    '..yyyyy..',
  ],
  palette: { Y: '#f6c945', y: '#c99212' },
};

export const refillV1Icon: PixelMap = {
  rows: [
    '..yyyyy.k',
    '.yYYYYYkk',
    'yYYYYYkrk',
    'yYYYYYYk.',
    'yYYYYYYy.',
    'kYYYYYYy.',
    'kkYYYYy..',
    'k.yyyyy..',
    '.........',
  ],
  palette: { Y: '#f6c945', k: 'var(--ink)', r: '#d9473b', y: '#c99212' },
};

export const refillV2Icon: PixelMap = {
  rows: [
    '..yyyyy.g',
    '.yYYYYYgg',
    'yYYYYYgg.',
    'yYYYYYYy.',
    'yYYYYYYy.',
    '.gYYYYYy.',
    'ggYYYYy..',
    'g.yyyyy..',
    '.........',
  ],
  palette: { Y: '#f6c945', g: '#3fa65a', y: '#c99212' },
};

export const tokenReviewIcon: PixelMap = {
  rows: [
    '..yyy....',
    '.yYYYy...',
    '.kkkkk...',
    'kwwwwwk..',
    'kwYYYwk..',
    'kwwwwwk..',
    '.kkkkkkk.',
    '......kk.',
    '.......kk',
  ],
  palette: { Y: '#f6c945', k: 'var(--ink)', w: 'var(--panel)', y: '#c99212' },
};

export const autoReviewerIcon: PixelMap = {
  rows: [
    '...k.....',
    '.kkkkk...',
    '.kckck...',
    '.kkkkk...',
    '..kkkk...',
    '.kwwwwk..',
    '.kwYYwk..',
    '..kkkkkk.',
    '......kk.',
  ],
  palette: { Y: '#f6c945', c: '#59b7ff', k: 'var(--ink)', w: 'var(--panel)' },
};

export const decisionIcon: PixelMap = {
  rows: [
    '....k....',
    '.kkkkkkk.',
    '.koooook.',
    '.kkkkkkk.',
    '....k....',
    '.kkkkkkk.',
    '.kpppppk.',
    '.kkkkkkk.',
    '....k....',
  ],
  palette: { k: 'var(--ink)', o: '#e8892f', p: '#8b7dff' },
};

/** Ship a release: a small rocket. */
export const releaseIcon: PixelMap = {
  rows: [
    '....k....',
    '...kwk...',
    '...kwk...',
    '..kwcwk..',
    '..kwwwk..',
    '.kkwwwkk.',
    '.k.kkk.k.',
    '...rYr...',
    '....r....',
  ],
  palette: { k: 'var(--ink)', w: 'var(--panel)', c: '#59b7ff', r: '#e8483c', Y: '#f6c945' },
};

/** History: an achievement. */
export const trophyIcon: PixelMap = {
  rows: [
    'kkkkkkkkk',
    'kYYYYYYYk',
    'YkYYYYYkY',
    'YkYYwYYkY',
    '.kYYYYYk.',
    '..kYYYk..',
    '...kYk...',
    '..kkkkk..',
    '.kYYYYYk.',
  ],
  palette: { k: 'var(--ink)', Y: '#f6c945', w: '#fff4c2' },
};

/** History: an ending (the finish flag). */
export const flagIcon: PixelMap = {
  rows: [
    'kkkkkkkk.',
    'kwkwkwkk.',
    'kkwkwkwk.',
    'kwkwkwkk.',
    'kkkkkkkk.',
    'k........',
    'k........',
    'k........',
    'kk.......',
  ],
  palette: { k: 'var(--ink)', w: 'var(--panel)' },
};

/** History: the release jackpot (a palm tree on the beach). */
export const palmIcon: PixelMap = {
  rows: [
    '.gg...gg.',
    'g..ggg..g',
    '...gbg...',
    '..g.b.g..',
    '....b....',
    '....b....',
    '...b.....',
    '...b.....',
    'yyyyyyyyy',
  ],
  palette: { g: '#4f9b55', b: '#8a5a33', y: '#e7b42f' },
};
