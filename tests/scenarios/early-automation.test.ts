import { describe, expect, it } from 'vitest';
import { catalog } from '../../src/content/catalog';
import { createRun } from '../../src/game/createRun';
import {
  coordinationEfficiency,
  deriveRates,
  qualityEfficiency,
  tokenDemandPerSecond,
} from '../../src/game/economy';
import type { RunState } from '../../src/game/types';
import {
  acknowledgeReveals,
  baselineBuyer,
  baselineCare,
  baselinePrimary,
  type Policy,
} from '../helpers/scenario';
import { applyCommand } from '../../src/game/commands';
import { stepRun } from '../../src/game/simulation';

interface Observed {
  run: RunState;
  unlockAt: Record<string, number>;
  tokenLimitedMs: number;
  /** Tokens would last under 20 s of demand: the player has to buy (or auto-refill does). */
  tokenShortMs: number;
  packs: number;
  debtOrCoordinationLimitedMs: number;
}

/** Run the baseline strategy until `target` is discovered, measuring bottleneck time. */
function play(seed: number, target: string, limitMs: number, extra: Policy[] = []): Observed {
  let run = createRun(seed, `early-${seed}`);
  const policies: Policy[] = [
    baselinePrimary,
    baselineBuyer,
    acknowledgeReveals,
    ...baselineCare,
    ...extra,
  ];
  const unlockAt: Record<string, number> = {};
  let tokenLimitedMs = 0;
  let shortMs = 0;
  let packs = 0;
  let debtOrCoordinationLimitedMs = 0;
  while (run.activeMs < limitMs && !run.unlockedTechnologyIds.includes(target as never)) {
    for (const policy of policies) {
      for (const command of policy({ run, catalog })) {
        const result = applyCommand(run, command, run.activeMs, catalog);
        if (
          command.type === 'buyUpgrade' &&
          command.id === 'token-supply' &&
          result.result === 'applied'
        )
          packs += 1;
        run = result.run;
      }
    }
    run = stepRun(run, 100, catalog).run;
    for (const id of run.unlockedTechnologyIds) unlockAt[id] ??= run.activeMs;
    const rates = deriveRates(run, catalog);
    const active = Math.min(rates.agents, rates.compute);
    if (active > 0 && run.economy.tokens < 1 && run.economy.tasks > 0) tokenLimitedMs += 100;
    if (active > 0 && run.economy.tokens < tokenDemandPerSecond(rates) * 20) shortMs += 100;
    if (
      active > 0 &&
      (qualityEfficiency(run.economy.debt) < 0.85 ||
        coordinationEfficiency(rates.managed, active) < 0.6)
    ) {
      debtOrCoordinationLimitedMs += 100;
    }
    expect(Number.isFinite(run.economy.output)).toBe(true);
  }
  return {
    run,
    unlockAt,
    tokenLimitedMs,
    tokenShortMs: shortMs,
    packs,
    debtOrCoordinationLimitedMs,
  };
}

describe('early automation route', () => {
  const result = play(101, 'manager-agent', 25 * 60_000);

  it('reaches the manager agent from a new run with ordinary commands', () => {
    const minutes = (ms: number | undefined) => ((ms ?? Infinity) / 60_000).toFixed(1);
    console.info(
      'unlock minutes:',
      Object.entries(result.unlockAt)
        .map(([id, ms]) => `${id}@${minutes(ms)}`)
        .join(' '),
    );
    expect(result.run.unlockedTechnologyIds).toContain('manager-agent');
    expect(result.unlockAt['manager-agent']).toBeLessThan(18 * 60_000);
  });

  it('spends real time limited by tokens and by debt or coordination', () => {
    console.info(
      `tokens short ${result.tokenShortMs / 1000}s (${result.packs} packs bought), debt/coordination-limited ${result.debtOrCoordinationLimitedMs / 1000}s`,
    );
    // Tokens are bought with code: the constraint shows as time with tokens running short
    // (a purchase is due) and as repeated purchases, not as agents idling at zero.
    expect(result.tokenShortMs).toBeGreaterThan(20_000);
    expect(result.packs).toBeGreaterThanOrEqual(3);
    expect(result.debtOrCoordinationLimitedMs).toBeGreaterThan(20_000);
  });

  it('keeps the cat alive with baseline care and the history free of duplicates', () => {
    expect(result.run.cat.alive).toBe(true);
    const tech = result.run.history
      .filter((e) => e.kind === 'technology')
      .map((e) => e.kind === 'technology' && e.id);
    expect(new Set(tech).size).toBe(tech.length);
  });
});

describe('recovery from a temporarily bad decision', () => {
  it('climbs back from zero tokens and heavy debt without any special purchase', () => {
    const base = play(7, 'reviewer', 20 * 60_000).run;
    const broke: RunState = {
      ...base,
      economy: { ...base.economy, tokens: 0, debt: 120, output: 0 },
    };
    let run = broke;
    for (let i = 0; i < 1200; i += 1) {
      if (run.activeMs % 5000 === 0)
        run = applyCommand(run, { type: 'primaryAction' }, run.activeMs, catalog).run;
      run = stepRun(run, 100, catalog).run;
    }
    expect(run.economy.output).toBeGreaterThan(100);
    expect(run.economy.debt).toBeLessThan(120);
  });
});
