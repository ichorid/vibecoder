/**
 * CLI: `npm run music:import-midi -- [--source music/sources/rpgchip] [--check]`.
 * Converts the CC0 MIDI songs listed in `<source>/plan.json` into unreviewed candidate patterns
 * under `music/patterns/<era>/` (see midiImportLib.ts). `--check` fails when the files differ from
 * what the importer produces. A pattern that already has a review is never overwritten: change
 * the importer or plan, then publish the new music as `revision + 1`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildCatalog } from '../../src/music/core/catalog';
import { parseMidi } from './midiFile';
import { importAll, patternFile, type ImportPlan } from './midiImportLib';
import { readReviews } from './packLib';
import { readRepository } from './sources';

const args = process.argv.slice(2).filter((a) => a !== '--');
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const root = 'music';
const source = value('--source') ?? 'music/sources/rpgchip';
const check = args.includes('--check');

const plan = JSON.parse(readFileSync(path.join(source, 'plan.json'), 'utf8')) as ImportPlan;
const { catalog, diagnostics } = buildCatalog(readRepository(root));
const broken = diagnostics.filter((d) => d.level === 'error');
if (broken.length > 0) {
  for (const d of broken) console.error(`error   ${d.message}`);
  process.exit(1);
}
const result = importAll(plan, (file) => parseMidi(readFileSync(path.join(source, file))), catalog);
for (const line of result.report) console.log(line);

const reviewErrors: string[] = [];
const reviewed = new Set(
  readReviews(root, reviewErrors).map((r) => `${r.patternId}@${r.revision}`),
);
const produced = new Set(result.patterns.map((p) => path.join(root, patternFile(p))));
const prefixes = plan.songs.map((s) => `${s.id}-`);
const stale = readdirSync(path.join(root, 'patterns'), { recursive: true, encoding: 'utf8' })
  .map((f) => path.join(root, 'patterns', f))
  .filter((f) => f.endsWith('.json') && prefixes.some((p) => path.basename(f).startsWith(p)))
  .filter((f) => !produced.has(f));

let problems = 0;
for (const pattern of result.patterns) {
  const file = path.join(root, patternFile(pattern));
  const text = `${JSON.stringify(pattern, null, 2)}\n`;
  const current = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as unknown) : null;
  const same = current !== null && JSON.stringify(current) === JSON.stringify(pattern);
  if (same) continue;
  if (check) {
    console.error(`${file} is ${current === null ? 'missing' : 'out of date'}`);
    problems += 1;
  } else if (current !== null && reviewed.has(`${pattern.id}@${pattern.revision}`)) {
    console.error(`${file} has a review: bump its revision instead of overwriting it`);
    problems += 1;
  } else {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
    console.log(`wrote ${file}`);
  }
}
for (const file of stale) {
  console.error(
    `${file} is no longer produced by the plan: delete it (or keep it as a manual pattern)`,
  );
  problems += 1;
}
if (problems > 0) process.exit(1);
console.log(
  `music: ${result.patterns.length} imported patterns ${check ? 'up to date' : 'written'}`,
);
