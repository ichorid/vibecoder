/**
 * The single export path for generated art (`npm run art:export`). Writes deterministic PNG +
 * "vibe-atlas/1" JSON into public/assets/. `--check` regenerates in memory and fails if the
 * committed files differ (stale or hand-edited output).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { OUT_DIR, outputs } from './build';

function main(): void {
  const check = process.argv.includes('--check');
  const stale: string[] = [];
  for (const [name, bytes] of outputs()) {
    const target = path.join(OUT_DIR, name);
    if (check) {
      if (!existsSync(target) || !readFileSync(target).equals(bytes)) stale.push(name);
      continue;
    }
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  if (check && stale.length > 0) {
    console.error(`art: generated assets are stale, run npm run art:export: ${stale.join(', ')}`);
    process.exit(1);
  }
  console.log(check ? 'art: generated assets up to date' : `art: exported to ${OUT_DIR}`);
}

main();
