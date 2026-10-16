/** Checks exported files against the manifest: presence, PNG format, atlas contract, tags. */
import type { AssetManifest } from '../src/content/assets';
import { validateAtlas } from '../src/content/atlas';

export interface AssetFiles {
  readText(file: string): string | null;
  pngSize(file: string): { width: number; height: number } | null;
}

export function validateAssets(manifest: AssetManifest, files: AssetFiles): string[] {
  const problems: string[] = [];
  for (const [theme, jsonFile] of Object.entries(manifest.atlases)) {
    const text = files.readText(jsonFile);
    if (text === null) {
      problems.push(`atlas ${theme}: missing ${jsonFile}`);
      continue;
    }
    let atlas: unknown;
    try {
      atlas = JSON.parse(text);
    } catch {
      problems.push(`atlas ${theme}: ${jsonFile} is not valid JSON`);
      continue;
    }
    const image =
      typeof atlas === 'object' &&
      atlas !== null &&
      'image' in atlas &&
      typeof atlas.image === 'string'
        ? atlas.image
        : '';
    for (const problem of validateAtlas(atlas, image ? files.pngSize(image) : null)) {
      problems.push(`atlas ${theme}: ${problem}`);
    }
    const animations =
      typeof atlas === 'object' &&
      atlas !== null &&
      'animations' in atlas &&
      typeof atlas.animations === 'object'
        ? (atlas.animations ?? {})
        : {};
    for (const tag of manifest.requiredAnimations) {
      if (!(tag in animations)) problems.push(`atlas ${theme}: missing animation tag "${tag}"`);
    }
  }
  for (const asset of [...manifest.illustrations, ...manifest.memorial]) {
    if (files.pngSize(asset.file) === null)
      problems.push(`${asset.id}: missing or invalid PNG ${asset.file}`);
  }
  return problems;
}
