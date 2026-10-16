import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { createRun } from './createRun';
import type { TechnologyId } from './ids';
import { stepRun } from './simulation';
import type { RunState } from './types';

const balance = catalog.balance.chatter;

function withTechnologies(ids: readonly TechnologyId[], seed = 5): RunState {
  const run = createRun(seed, `chatter-${seed}`);
  return {
    ...run,
    unlockedTechnologyIds: [...ids],
    upgradeLevels: Object.fromEntries(ids.map((id) => [id, 1])),
    history: ids.map((id) => ({ kind: 'technology' as const, id, activeMs: 0 })),
    // Plenty of tokens and output so no other narrative event competes for the log.
    economy: { ...run.economy, tokens: 1e9, output: 1e6 },
  };
}

/** Step `ms` of active time and collect the console chatter lines in order. */
function chatterOver(
  start: RunState,
  ms: number,
): { run: RunState; lines: { text: string; at: number }[] } {
  let run = start;
  const lines: { text: string; at: number }[] = [];
  for (let t = 0; t < ms; t += 100) {
    const before = run.log.length;
    run = stepRun(run, 100, catalog).run;
    for (const entry of run.log.slice(before)) {
      if (entry.text.startsWith('💬 '))
        lines.push({ text: entry.text.slice(3), at: entry.activeMs });
    }
  }
  return { run, lines };
}

describe('console chatter', () => {
  it('says nothing before any technology is unlocked', () => {
    expect(chatterOver(createRun(1, 'none'), 5 * 60_000).lines).toEqual([]);
  });

  it('only uses the pools of unlocked technologies, at the configured pace', () => {
    const unlocked: TechnologyId[] = ['autocomplete', 'generated-snippets', 'ai-native-ide'];
    const { lines } = chatterOver(withTechnologies(unlocked), 20 * 60_000);
    const allowed = new Set(unlocked.flatMap((id) => catalog.chatter[id] ?? []));
    expect(lines.length).toBeGreaterThan(10);
    for (const line of lines) expect(allowed.has(line.text)).toBe(true);
    for (let i = 1; i < lines.length; i += 1) {
      const gap = (lines[i]?.at ?? 0) - (lines[i - 1]?.at ?? 0);
      expect(gap).toBeGreaterThanOrEqual(balance.minGapMs);
      expect(gap).toBeLessThanOrEqual(balance.maxGapMs + 100);
    }
  });

  it('does not repeat a line of a technology before its whole pool was used', () => {
    const { lines } = chatterOver(withTechnologies(['terminal-agent']), 15 * 60_000);
    const pool = catalog.chatter['terminal-agent'] ?? [];
    const first = lines.slice(0, pool.length).map((l) => l.text);
    expect(new Set(first).size).toBe(first.length);
  });

  it('newer technologies talk more often', () => {
    const order = catalog.technologies.map((t) => t.id).slice(0, 10);
    const { lines } = chatterOver(withTechnologies(order), 60 * 60_000);
    const newest = new Set(
      order.slice(-balance.newestCount).flatMap((id) => catalog.chatter[id] ?? []),
    );
    const share = lines.filter((l) => newest.has(l.text)).length / lines.length;
    // 3 of 10 technologies weighted ×3: expected share 9/16.
    expect(share).toBeGreaterThan(0.4);
  });

  it('is deterministic for a seed', () => {
    const a = chatterOver(withTechnologies(['reviewer', 'worktrees'], 9), 5 * 60_000).lines;
    const b = chatterOver(withTechnologies(['reviewer', 'worktrees'], 9), 5 * 60_000).lines;
    expect(a).toEqual(b);
  });
});
