/** Resolve manifest asset IDs to URLs under the static asset base (app composition only). */
import { assetManifest } from '../content/assets';

const base = `${import.meta.env.BASE_URL}assets/`;
const illustrationFiles = new Map<string, string>(
  assetManifest.illustrations.map((asset) => [asset.id, asset.file]),
);

export function illustrationUrl(illustrationId: string): string | null {
  const file = illustrationFiles.get(illustrationId);
  return file ? `${base}${file}` : null;
}

export function atlasUrl(theme: 'light' | 'dark'): string {
  return `${base}${assetManifest.atlases[theme]}`;
}

export const memorialUrls: readonly string[] = assetManifest.memorial.map(
  (photo) => `${base}${photo.file}`,
);
