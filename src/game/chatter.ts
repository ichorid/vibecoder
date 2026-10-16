/**
 * Console chatter: every so often the terminal prints a silly line from the pool of an unlocked
 * technology. The newest technologies talk more; within a pool the least recently used line is
 * said first. Timing and choices use the run's narrative RNG stream; `narrative.lastAt` keeps
 * when chatter is next due and when each line was last said (no extra save fields).
 */
import type { Catalog } from './catalog';
import { appendLog } from './log';
import { nextFloat, nextInt } from './random';
import type { RunState } from './types';

const NEXT = 'chatter:next';
const lineKey = (technology: string, index: number) => `chatter:${technology}:${index}`;

export function evaluateChatter(run: RunState, catalog: Catalog): RunState {
  if (run.status !== 'playing') return run;
  const talkers = run.unlockedTechnologyIds.filter((id) => (catalog.chatter[id]?.length ?? 0) > 0);
  if (talkers.length === 0) return run;
  const { minGapMs, maxGapMs, newestCount, newestWeight } = catalog.balance.chatter;
  const due = run.narrative.lastAt[NEXT];
  let rng = run.rng.narrative;
  const schedule = (lastAt: Record<string, number>) => {
    const gap = nextInt(rng, minGapMs, maxGapMs);
    rng = gap.state;
    return { ...lastAt, [NEXT]: run.activeMs + gap.value };
  };
  if (due === undefined) {
    const lastAt = schedule(run.narrative.lastAt);
    return { ...run, rng: { ...run.rng, narrative: rng }, narrative: { ...run.narrative, lastAt } };
  }
  if (run.activeMs < due) return run;

  // Pick a technology: the newest few count `newestWeight` times.
  const weights = talkers.map((_, i) => (i >= talkers.length - newestCount ? newestWeight : 1));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const roll = nextFloat(rng);
  rng = roll.state;
  let pick = roll.value * total;
  let index = 0;
  while (index < talkers.length - 1 && pick >= (weights[index] ?? 0)) {
    pick -= weights[index] ?? 0;
    index += 1;
  }
  const technology = talkers[index] ?? talkers[0];
  const pool = (technology && catalog.chatter[technology]) || [];
  if (!technology || pool.length === 0) return run;

  // The least recently said line of that pool (never said counts as oldest); ties at random.
  const said = pool.map((_, i) => run.narrative.lastAt[lineKey(technology, i)] ?? -1);
  const oldest = Math.min(...said);
  const candidates = pool.map((_, i) => i).filter((i) => said[i] === oldest);
  const choice = nextInt(rng, 0, candidates.length - 1);
  rng = choice.state;
  const line = candidates[choice.value] ?? 0;

  const lastAt = schedule({ ...run.narrative.lastAt, [lineKey(technology, line)]: run.activeMs });
  return appendLog(
    { ...run, rng: { ...run.rng, narrative: rng }, narrative: { ...run.narrative, lastAt } },
    `💬 ${pool[line] ?? ''}`,
    catalog,
  );
}
