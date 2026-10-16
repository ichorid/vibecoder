/**
 * Production size report (`npm run build` runs it after Vite). Initial JS = the entry chunk
 * plus the eagerly loaded world renderer chunks; checks the architecture's starting budgets.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const KiB = 1024;
const BUDGET = { initialJsGzip: 350 * KiB, firstAssets: 1024 * KiB };

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(DIST);
const js = files.filter((f) => f.endsWith('.js'));
const gz = (file: string) => gzipSync(readFileSync(file)).length;
const html = readFileSync(path.join(DIST, 'index.html'), 'utf8');
const entry = js.filter((f) => html.includes(path.basename(f)));
const totalJsGzip = js.reduce((sum, f) => sum + gz(f), 0);
const entryGzip = entry.reduce((sum, f) => sum + gz(f), 0);
const firstAssets = files
  .filter((f) => /sprites-light\.(png|json)$/.test(f) || f.endsWith('.css'))
  .reduce((sum, f) => sum + statSync(f).size, 0);
const art = files.filter((f) => f.endsWith('.png')).reduce((sum, f) => sum + statSync(f).size, 0);

const kib = (n: number) => `${(n / KiB).toFixed(1)} KiB`;
console.log(
  `size: entry JS ${kib(entryGzip)} gzip; all JS ${kib(totalJsGzip)} gzip (includes lazy Pixi)`,
);
console.log(`size: first assets (light atlas + CSS) ${kib(firstAssets)}; all PNG art ${kib(art)}`);

// Upper bound for "initial JS including the first Pixi chunk": every JS chunk, since the
// world renderer loads right after the DOM shell. Lab chunks (later) are excluded by name.
const initial = js.filter((f) => !/music-lab/.test(f)).reduce((sum, f) => sum + gz(f), 0);
const failures: string[] = [];
if (initial > BUDGET.initialJsGzip)
  failures.push(`initial JS ${kib(initial)} > ${kib(BUDGET.initialJsGzip)}`);
if (firstAssets > BUDGET.firstAssets)
  failures.push(`first assets ${kib(firstAssets)} > ${kib(BUDGET.firstAssets)}`);
if (failures.length > 0) {
  console.error(`size budget exceeded: ${failures.join('; ')}`);
  process.exit(1);
}
console.log(
  `size: within budgets (initial JS ≤ ${kib(BUDGET.initialJsGzip)}, first assets ≤ ${kib(BUDGET.firstAssets)})`,
);
