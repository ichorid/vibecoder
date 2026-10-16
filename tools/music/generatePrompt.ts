/**
 * CLI: `npm run music:prompt -- --era <id> [--template era|lead] [--root music] [--out file.md]`.
 * Only writes reviewable text; it never starts an agent or any other process.
 */
import { writeFileSync } from 'node:fs';
import { generatePrompt } from './promptLib';

const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const template = option('--template') ?? 'era';
if (template !== 'era' && template !== 'lead') {
  console.error(`unknown --template "${template}" (era | lead)`);
  process.exit(1);
}
const result = await generatePrompt({
  root: option('--root') ?? 'music',
  era: option('--era') ?? '',
  template,
});
if (!result.ok) {
  console.error(result.error);
  process.exit(1);
}
const out = option('--out');
if (out) {
  writeFileSync(out, result.value);
  console.log(`music: wrote ${out}`);
} else {
  process.stdout.write(result.value);
}
