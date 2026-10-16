/**
 * Dev utility (not a test): how varied first demos are. Prints the spread of the judge's
 * measures over N first demos, the mix of kinds, and the mean picture difference between pairs
 * (higher = more diverse). Usage: npx vite-node tools/demoStats.ts -- [--count 48] [--seed 3]
 */
import { archetypeFor, hornChain } from '../src/demo/genome';
import { firstDemo, maskDiff } from '../src/demo/judge';
import { subSeed } from '../src/demo/rng';

const args = process.argv.slice(2).filter((a) => a !== '--');
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? (args[i + 1] as string) : fallback;
};
const count = Number(flag('count', '48'));
const seed = Number(flag('seed', '3'));

const demos = Array.from({ length: count }, (_, i) => {
  const s = subSeed(seed, i);
  return { kind: archetypeFor(s), ...firstDemo(s) };
});
const q = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const at = (p: number) => (s[Math.floor(p * (s.length - 1))] ?? 0).toFixed(2);
  return `${at(0.1)} / ${at(0.5)} / ${at(0.9)}`;
};
for (const part of ['coverage', 'cells', 'detail', 'symmetry', 'motion', 'flow'] as const) {
  console.log(`${part.padEnd(9)} p10/p50/p90 ${q(demos.map((d) => d.verdict.parts[part]))}`);
}
const tally = (f: (d: (typeof demos)[number]) => string) => {
  const t: Record<string, number> = {};
  for (const d of demos) t[f(d)] = (t[f(d)] ?? 0) + 1;
  return JSON.stringify(t);
};
console.log(
  'kinds    ',
  tally((d) => d.kind),
);
console.log(
  'trees    ',
  tally((d) =>
    hornChain(d.genome.root)
      .map((h) => h.kind)
      .join('/'),
  ),
);
console.log(
  'layouts  ',
  tally((d) => `${d.genome.layout}${d.genome.copies > 1 ? `×${d.genome.copies}` : ''}`),
);
console.log(
  'dotted   ',
  demos.filter((d) => (hornChain(d.genome.root).at(-1)?.dots ?? 1) !== 1).length,
  '/',
  count,
);
let sum = 0,
  pairs = 0;
for (let i = 0; i < demos.length; i++)
  for (let j = i + 1; j < demos.length; j++) {
    const a = demos[i]?.verdict.masks[1],
      b = demos[j]?.verdict.masks[1];
    if (a && b) {
      sum += maskDiff(a, b);
      pairs++;
    }
  }
console.log('mean pairwise picture difference', (sum / pairs).toFixed(3));
