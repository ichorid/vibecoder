/**
 * Level of detail from projected CSS-pixel size (identical across device pixel ratios), with a
 * 10% hysteresis band around each threshold. Presentation only — never a gameplay state.
 */
export type ClusterLod = 'detail' | 'compact' | 'dots';
export type CatLod = 'sprite' | 'cluster' | 'pixel' | 'hidden';

// Plan start was 96/16 px; visual review (P08) showed the room collapsing to an icon at ~50 px,
// long before the programmer should become unreadable, so clusters keep detail down to 32 px.
export const LOD = {
  detailPx: 32,
  compactPx: 8,
  hysteresis: 0.1,
  catSpritePx: 12,
  catClusterPx: 3,
  catPixelPx: 0.5,
} as const;

/** CSS pixels occupied by `worldSize` units at `zoom` (CSS px per unit). */
export function projectedSize(worldSize: number, zoom: number): number {
  return worldSize * zoom;
}

/** Pick a band from descending thresholds, keeping the previous band inside its margin. */
function banded<T extends string>(
  px: number,
  bands: readonly [T, number][],
  previous: T | null,
): T {
  const plain = bands.find(([, min]) => px >= min)?.[0] ?? bands[bands.length - 1]?.[0];
  if (plain === undefined) throw new Error('no bands');
  if (previous === null) return plain;
  const index = bands.findIndex(([band]) => band === previous);
  const target = bands.findIndex(([band]) => band === plain);
  if (index < 0 || target === index) return plain;
  const [, prevMin] = bands[index] ?? [previous, 0];
  if (target > index) {
    // Shrinking: leave the previous band only below its threshold minus the margin.
    return px >= prevMin * (1 - LOD.hysteresis) ? previous : plain;
  }
  // Growing: enter a larger band only above its threshold plus the margin.
  const [, nextMin] = bands[target] ?? [plain, 0];
  return px >= nextMin * (1 + LOD.hysteresis) ? plain : previous;
}

export function clusterLod(px: number, previous: ClusterLod | null): ClusterLod {
  return banded<ClusterLod>(
    px,
    [
      ['detail', LOD.detailPx],
      ['compact', LOD.compactPx],
      ['dots', 0],
    ],
    previous,
  );
}

/**
 * The world cat: sprite → orange cluster → single pixel. It is hidden when dead (at every
 * zoom), at the final framing, or once smaller than about half a CSS pixel.
 */
export function catLod(
  px: number,
  alive: boolean,
  finalFraming: boolean,
  previous: CatLod | null,
): CatLod {
  if (!alive || finalFraming) return 'hidden';
  return banded<CatLod>(
    px,
    [
      ['sprite', LOD.catSpritePx],
      ['cluster', LOD.catClusterPx],
      ['pixel', LOD.catPixelPx],
      ['hidden', 0],
    ],
    previous,
  );
}
