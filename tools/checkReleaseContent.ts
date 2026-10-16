/** CLI for `npm run check:release-content`. */
import { readdirSync, readFileSync } from 'node:fs';
import { assetManifest } from '../src/content/assets';
import { catalog } from '../src/content/catalog';
import { worldAdditions } from '../src/content/world';
import { nodeAssetFiles } from './assetFiles';
import { validateRelease } from './validateRelease';

const problems = validateRelease({
  catalog,
  assets: assetManifest,
  worldAdditions,
  files: nodeAssetFiles('public/assets'),
  requiredTechnologies: 28,
  requiredEndings: 10,
  scenarioText: readdirSync('tests/scenarios/endings')
    .map((file) => readFileSync(`tests/scenarios/endings/${file}`, 'utf8'))
    .join('\n'),
});
if (problems.length > 0) {
  for (const problem of problems) console.error(`release: ${problem}`);
  process.exit(1);
}
console.log(
  `release content OK: ${catalog.technologies.length} technologies with unique art and scene additions`,
);
