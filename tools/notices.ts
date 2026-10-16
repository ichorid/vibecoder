/** CLI for tools/noticesLib.ts: `npm run notices` writes, `-- --check` verifies. */
import { readFileSync, writeFileSync } from 'node:fs';
import { NOTICES_FILE, productionPackages, renderNotices } from './noticesLib';

const text = renderNotices(productionPackages(readFileSync('package-lock.json', 'utf8')));
if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(NOTICES_FILE, 'utf8');
  } catch {
    // missing: reported below
  }
  if (current !== text) {
    console.error(`${NOTICES_FILE} is out of date: run npm run notices`);
    process.exit(1);
  }
  console.log(`notices: ${NOTICES_FILE} up to date`);
} else {
  writeFileSync(NOTICES_FILE, text);
  console.log(`notices: wrote ${NOTICES_FILE}`);
}
