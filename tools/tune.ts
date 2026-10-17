/**
 * Dev utility for balance tuning (not a test): measure runs against the economy contract
 * (docs/economy_redesign.md §4) and print a per-window table plus the summary metrics.
 * Usage: npx vite-node tools/tune.ts -- [--seed 101] [--cps 3] [--cps-after 0.333]
 *        [--buyer baseline|greedy|seer|saver] [--care play|none] [--experience 0] [--minutes 60]
 *        [--react 1] [--freelance 1.5] [--job yes|no] [--frugal 1]
 *        [--seeds 1,7,42,101,2024]   (summary only, one line per seed)
 */
import { measureRun, type Buyer, type RunMetrics } from '../tests/helpers/metrics';

const args = process.argv.slice(2).filter((a) => a !== '--');
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? (args[i + 1] as string) : fallback;
};
const options = {
  cps: Number(flag('cps', '3')),
  cpsAfter: Number(flag('cps-after', String(1 / 3))),
  buyer: flag('buyer', 'baseline') as Buyer,
  care: flag('care', 'play') as 'play' | 'none',
  experience: Number(flag('experience', '0')),
  limitMin: Number(flag('minutes', '60')),
  react: Number(flag('react', '1')),
  freelance: Number(flag('freelance', '1.5')),
  takeJob: flag('job', 'no') === 'yes',
  frugal: Number(flag('frugal', '1')),
};
const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4);
const num = (x: number | null) => (x === null ? '  –  ' : x.toFixed(1).padStart(5));
const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0);

function summary(seed: number, m: RunMetrics): string {
  return [
    `seed ${String(seed).padStart(4)}`,
    `company ${num(m.companyMin)}`,
    `acts ${m.acts.map(num).join(' ')}`,
    `walls ${m.wallsMin.map(num).join(' ')}`,
    `cadence ${m.cadenceSec.toFixed(0)}s`,
    `2+cards ${pct(m.twoOffersShare)}`,
    `hidden ${m.hiddenBindingSec.toFixed(0)}s`,
    `q<.9 ${pct(m.qualityLowShare)}`,
    `coord<.95 ${pct(m.coordLowShare)}`,
    `debt≤${m.peakDebt.toFixed(0)}`,
    `PM→co ${num(m.pmToCompanyMin)}`,
    `disaster ${m.disasterSec.map((s) => `${s.toFixed(0)}s`).join(',') || '–'}`,
    `freeze+${m.freezeDelaySec === null ? '–' : `${m.freezeDelaySec.toFixed(0)}s`}`,
    `cat ${m.run.cat.alive ? 'alive' : 'gone'}`,
    `taxed ${pct(m.taxedShareEarly)}`,
    `gigs ${m.gigsPaid} ${m.gigShareByAct.map(pct).join('')}`,
    `missed ${m.rentMissed}`,
    `evicted ${num(m.evictedMin)}`,
    `end ${m.run.ending?.id ?? '–'}`,
  ].join(' | ');
}

const seedsArg = flag('seeds', '');
if (seedsArg) {
  console.log(
    `cps ${options.cps}→${options.cpsAfter.toFixed(2)} buyer ${options.buyer} care ${options.care} xp ${options.experience}`,
  );
  for (const seed of seedsArg.split(',').map(Number))
    console.log(summary(seed, measureRun(seed, options)));
} else {
  const seed = Number(flag('seed', '101'));
  const m = measureRun(seed, options);
  console.log(
    '   min  technology                 agents compute tasks tokens  q<.9 crd<.95 2+crd manual  money    rev   cost',
  );
  for (const w of m.windows) {
    console.log(
      `${w.startMin.toFixed(2).padStart(6)} ${w.tech.padEnd(26)} ${pct(w.binding.agents)}   ${pct(w.binding.compute)}  ${pct(w.binding.tasks)}  ${pct(w.binding.tokens)}  ${pct(w.qualityLow)}   ${pct(w.coordLow)}  ${pct(w.twoOffers)}  ${pct(w.manualShare)} ${fmt(w.money).padStart(6)} ${fmt(w.revenue).padStart(6)} ${fmt(w.cost).padStart(6)}`,
    );
  }
  console.log(summary(seed, m));
}
