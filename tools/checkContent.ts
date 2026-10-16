/** CLI for `npm run check:content`: validate the authored catalog and manifest. */
import { assetManifest } from '../src/content/assets';
import { catalog } from '../src/content/catalog';
import { worldAdditions } from '../src/content/world';
import { validateContent } from './validateContent';

const issues = validateContent({ catalog, assets: assetManifest, worldAdditions });
const placeholders = assetManifest.illustrations.filter((a) => a.placeholder).length;

if (issues.length > 0) {
  for (const issue of issues) console.error(`content: ${issue.message}`);
  process.exit(1);
}
console.log(
  `content OK: ${catalog.technologies.length} technologies, ${catalog.upgrades.length} upgrades` +
    (placeholders > 0 ? `; ${placeholders} placeholder illustrations (release debt)` : ''),
);
