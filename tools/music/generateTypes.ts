/**
 * Generate TS contracts from the canonical JSON Schemas (`npm run music:types`), or with
 * `--check` (part of `music:check-types`) fail if the committed generated file is stale.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { compile } from 'json-schema-to-typescript';
import prettier from 'prettier';

const TARGET = 'src/music/data/patterns.generated.ts';
const SOURCES: [string, string][] = [
  ['music/PATTERN_SCHEMA.json', 'PatternDocument'],
  ['music/schemas/era.schema.json', 'EraDocument'],
  ['music/schemas/preset.schema.json', 'PresetDocument'],
  ['music/schemas/arrangement.schema.json', 'ArrangementDocument'],
  ['music/schemas/motif.schema.json', 'MotifDocument'],
  ['music/schemas/review.schema.json', 'ReviewDocument'],
];

async function generate(): Promise<string> {
  const parts: string[] = [
    '/* Generated from music/*.json schemas by tools/music/generateTypes.ts. Do not edit. */',
  ];
  for (const [file, name] of SOURCES) {
    const schema = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    parts.push(
      await compile({ ...schema, title: name }, name, {
        bannerComment: '',
        additionalProperties: false,
        declareExternallyReferenced: true,
        strictIndexSignatures: true,
        format: false,
      }),
    );
  }
  const options = (await prettier.resolveConfig(TARGET)) ?? {};
  return prettier.format(parts.join('\n'), { ...options, filepath: TARGET });
}

const check = process.argv.includes('--check');
const output = await generate();
if (check) {
  const current = readFileSync(TARGET, 'utf8');
  if (current !== output) {
    console.error(`music: ${TARGET} is stale; run npm run music:types`);
    process.exit(1);
  }
  console.log('music: generated types up to date');
} else {
  writeFileSync(TARGET, output);
  console.log(`music: wrote ${TARGET}`);
}
