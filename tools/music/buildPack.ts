/**
 * CLI: `npm run music:pack -- --mode approved|demo [--choose id@rev]... [--root music] [--check]`.
 * Writes `src/music/data/pack.<mode>.json` (generated; never edit). `--check` fails when the
 * committed pack differs from what the repository and exported reviews produce.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildPack, packFile, serializePack } from './packLib';

const args = process.argv.slice(2).filter((a) => a !== '--');
const values = (name: string) =>
  args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1] as string] : []));
const mode = values('--mode')[0] ?? 'approved';
if (mode !== 'approved' && mode !== 'demo') {
  console.error(`unknown --mode "${mode}" (approved | demo)`);
  process.exit(1);
}
const result = await buildPack({
  root: values('--root')[0] ?? 'music',
  mode,
  choose: values('--choose'),
});
for (const w of result.warnings) console.warn(`warning ${w}`);
for (const e of result.errors) console.error(`error   ${e}`);
if (!result.pack) process.exit(1);
const text = serializePack(result.pack);
const file = packFile(mode);
if (args.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(file, 'utf8');
  } catch {
    // missing file: reported below
  }
  if (current !== text) {
    console.error(`${file} is out of date: run npm run music:pack -- --mode ${mode}`);
    process.exit(1);
  }
  console.log(`music: ${file} up to date (${result.pack.manifest.length} patterns)`);
} else {
  writeFileSync(file, text);
  console.log(`music: wrote ${file} (${result.pack.manifest.length} ${mode} patterns)`);
}
