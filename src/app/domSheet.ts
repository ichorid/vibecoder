/** Load the sprite atlas for DOM sprites (Cat view, foreground cat) — same data as Pixi. */
import { domAnimation, validateAtlas, type AtlasData } from '../content/atlas';
import type { DomSpriteSheet } from '../ui/contracts';
import { atlasUrl } from './assetUrls';

/** One load per theme for the page's lifetime; a failed load may be retried. */
const cache = new Map<'light' | 'dark', Promise<DomSpriteSheet | null>>();

export function loadDomSheet(theme: 'light' | 'dark'): Promise<DomSpriteSheet | null> {
  const known = cache.get(theme);
  if (known) return known;
  const loading = fetchDomSheet(theme).then((sheet) => {
    if (!sheet) cache.delete(theme);
    return sheet;
  });
  cache.set(theme, loading);
  return loading;
}

async function fetchDomSheet(theme: 'light' | 'dark'): Promise<DomSpriteSheet | null> {
  try {
    const url = atlasUrl(theme);
    const response = await fetch(url);
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (validateAtlas(data, null).some((p) => !p.startsWith('missing image'))) return null;
    const atlas = data as AtlasData;
    const animations: Record<string, ReturnType<typeof domAnimation>> = {};
    for (const tag of Object.keys(atlas.animations)) animations[tag] = domAnimation(atlas, tag);
    return {
      imageUrl: new URL(atlas.image, new URL(url, window.location.href)).toString(),
      width: atlas.size.w,
      height: atlas.size.h,
      animations,
    };
  } catch {
    return null;
  }
}
