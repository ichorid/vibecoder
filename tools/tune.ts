/**
 * Dev utility for balance tuning (not a test): run the baseline strategy from createRun and
 * print each discovery time with the economy state at that moment.
 * Usage: npx vite-node tools/tune.ts -- [seed] [minutes] [target]
 */
import { catalog } from '../src/content/catalog';
import { applyCommand } from '../src/game/commands';
import { createRun } from '../src/game/createRun';
import { coordinationEfficiency, deriveRates, qualityEfficiency } from '../src/game/economy';
import { stepRun } from '../src/game/simulation';
import {
  acknowledgeReveals,
  baselineBuyer,
  baselineCare,
  baselinePrimary,
  type Policy,
} from '../tests/helpers/scenario';

const [seedArg = '101', minutesArg = '40', target = ''] = process.argv
  .slice(2)
  .filter((a) => a !== '--');
let run = createRun(Number(seedArg), 'tune');
const policies: Policy[] = [baselinePrimary, baselineBuyer, acknowledgeReveals, ...baselineCare];
const seen = new Set<string>();
let lastOutput = 0;
let lastAt = 0;
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(1));
while (run.activeMs < Number(minutesArg) * 60_000) {
  for (const policy of policies) {
    for (const command of policy({ run, catalog }))
      run = applyCommand(run, command, run.activeMs, catalog).run;
  }
  run = stepRun(run, 100, catalog).run;
  for (const id of run.unlockedTechnologyIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const r = deriveRates(run, catalog);
    const active = Math.min(r.agents, r.compute);
    const rate =
      (run.stats.lifetimeOutput - lastOutput) / Math.max(1, (run.activeMs - lastAt) / 1000);
    console.log(
      `${(run.activeMs / 60_000).toFixed(2).padStart(6)}m ${id.padEnd(26)} out/s≈${fmt(rate).padStart(7)} ` +
        `agents ${active}/${r.agents} tok ${fmt(run.economy.tokens)} sup ${r.tokenSupplyPerSecond} ` +
        `debt ${fmt(run.economy.debt)} q ${qualityEfficiency(run.economy.debt).toFixed(2)} ` +
        `coord ${coordinationEfficiency(r.managed, active).toFixed(2)} lv ${JSON.stringify(run.upgradeLevels).replace(/"/g, '').slice(0, 120)}`,
    );
    lastOutput = run.stats.lifetimeOutput;
    lastAt = run.activeMs;
  }
  if (target && seen.has(target)) break;
}
console.log(
  `end ${(run.activeMs / 60_000).toFixed(1)}m cat ${run.cat.alive ? 'alive' : 'dead'} output ${fmt(run.economy.output)}`,
);
