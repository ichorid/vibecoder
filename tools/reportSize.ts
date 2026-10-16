/**
 * Production size report (`npm run build` runs it after Vite). Initial JS = the entry chunk
 * plus the eagerly loaded world renderer chunks; checks the architecture's starting budgets.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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

// Initial JS = everything the game page can reach (static + dynamic imports, so lazy Pixi
// counts), except the audio graph (Tone, director, pack), imported only after the Sound gesture.
interface ManifestChunk {
  file: string;
  src?: string;
  isEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
}
const manifest = JSON.parse(readFileSync(path.join(DIST, '.vite/manifest.json'), 'utf8')) as Record<
  string,
  ManifestChunk
>;
const reachable = new Set<string>();
const visit = (key: string) => {
  const chunk = manifest[key];
  if (
    !chunk ||
    reachable.has(key) ||
    /music\/backend\/loader|app\/gameAudio/.test(chunk.src ?? key)
  )
    return;
  reachable.add(key);
  for (const next of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) visit(next);
};
visit('index.html');
const gameFiles = new Set([...reachable].map((key) => path.join(DIST, manifest[key]?.file ?? '')));
const initial = js.filter((f) => gameFiles.has(f)).reduce((sum, f) => sum + gz(f), 0);
const labLeaks = [...reachable].filter((key) => /music-lab|reviewStore/.test(key));
const labFiles = new Set<string>();
const visitLab = (key: string) => {
  const chunk = manifest[key];
  if (!chunk || labFiles.has(chunk.file)) return;
  labFiles.add(chunk.file);
  for (const next of chunk.imports ?? []) visitLab(next);
};
visitLab('music-lab/index.html');
const labGzip = [...labFiles].reduce((sum, f) => sum + gz(path.join(DIST, f)), 0);
console.log(`size: game initial JS ${kib(initial)} gzip; Music Lab page JS ${kib(labGzip)} gzip`);

const failures: string[] = [];
if (labLeaks.length > 0)
  failures.push(`game entry reaches Music Lab modules: ${labLeaks.join(', ')}`);
if (!existsSync(path.join(DIST, 'music-lab/index.html')))
  failures.push('music-lab/index.html missing');
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
