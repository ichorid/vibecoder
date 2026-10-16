import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { readPngSize } from '../art/lib/png';
import type { AssetFiles } from './validateAssets';

/** Reads exported files from disk for the asset validator. */
export function nodeAssetFiles(
  root: string,
): AssetFiles & { readBytes(file: string): Uint8Array | null } {
  return {
    readText(file) {
      const full = path.join(root, file);
      return existsSync(full) ? readFileSync(full, 'utf8') : null;
    },
    readBytes(file) {
      const full = path.join(root, file);
      return existsSync(full) ? readFileSync(full) : null;
    },
    pngSize(file) {
      const full = path.join(root, file);
      if (!existsSync(full)) return null;
      try {
        return readPngSize(readFileSync(full));
      } catch {
        return null;
      }
    },
  };
}
