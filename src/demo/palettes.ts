/**
 * Eight 18-colour palettes in the spirit of 8/16-bit machines. Index layout:
 * 0 background, 1 copper bars / far stars, 2–6 ramp A (dark → light), 7–11 ramp B,
 * 12–16 ramp C (bulbs, joints), 17 the brightest star.
 */
const hex = (s: string): readonly (readonly [number, number, number])[] =>
  s
    .split(' ')
    .map((h) => [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ]);

export const PALETTE_NAMES = [
  'breadbin',
  'vector',
  'cga',
  'furnace',
  'amiga',
  'mono',
  'violet',
  'copper',
] as const;

export const PALETTES = [
  hex(
    '000000 2a1050 201060 4030a0 7060e0 a0a0ff e0e0ff 401000 a04010 e08020 ffd040 ffffa0 004040 008080 40b0b0 80e0e0 d0ffff ffffff',
  ),
  hex(
    '000000 003020 002010 005030 00a040 40e070 c0ffc0 001800 004000 008000 00c000 a0ff60 202000 606000 a0a000 e0e040 ffffa0 e0ffe0',
  ),
  hex(
    '000000 500050 300030 800080 c000c0 ff50ff ffc0ff 003050 006090 00a0d0 50e0ff c0ffff 404040 808080 b0b0b0 e0e0e0 ffffff ffffff',
  ),
  hex(
    '100000 400000 300000 700000 b02000 f06000 ffd080 202020 505050 909090 c0c0c0 ffffff 302000 806000 c0a000 ffe040 ffffc0 fff0c0',
  ),
  hex(
    '000010 001040 101030 304070 5080b0 90c0e0 f0ffff 302000 806000 c09000 f0c000 fff080 300010 701030 b02050 f04080 ffa0c0 ffffff',
  ),
  hex(
    '000000 202020 101010 404040 707070 a0a0a0 e0e0e0 300010 701030 b02050 f04080 ffa0c0 002030 105070 3090b0 70d0f0 d0f8ff ffffff',
  ),
  hex(
    '080010 301040 1a0830 503080 9050c0 d090f0 fff0ff 003020 107040 30b060 80f090 e0ffe0 402000 905010 d09030 f0c070 fff0d0 ffffff',
  ),
  hex(
    '000000 402000 201000 603010 a05020 e09040 ffe0a0 001830 103060 2060a0 50a0e0 b0e0ff 202020 505050 909090 d0d0d0 ffffff ffffff',
  ),
];

/** Packed RGBA (little-endian ImageData order) for each palette entry. */
export function paletteRgba(index: number): Uint32Array {
  const pal = PALETTES[index % PALETTES.length] ?? PALETTES[0] ?? [];
  return Uint32Array.from(pal, ([r, g, b]) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0);
}
