/** CLI: `npm run music:validate [-- --era <id>] [-- --root <dir>]`. Exit 1 only on hard errors. */
import { validateCorpus } from './validateLib';

const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const report = validateCorpus(option('--root') ?? 'music', option('--era'));
for (const d of report.errors) console.error(`error   ${d.message}`);
for (const d of report.warnings) console.warn(`warning ${d.message}`);
console.log(
  `music: ${report.patterns} patterns, ${report.errors.length} errors, ${report.warnings.length} warnings`,
);
process.exit(report.errors.length > 0 ? 1 : 0);
