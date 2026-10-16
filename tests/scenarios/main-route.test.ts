import { describe, expect, it } from 'vitest';
import { catalog } from '../../src/content/catalog';
import { applyCommand } from '../../src/game/commands';
import { createRun } from '../../src/game/createRun';
import { TECHNOLOGY_IDS } from '../../src/game/ids';
import { stepRun } from '../../src/game/simulation';
import type { RunState } from '../../src/game/types';
import {
  acknowledgeReveals,
  baselineBuyer,
  baselineCare,
  baselinePrimary,
  playEvery,
  type Policy,
} from '../helpers/scenario';

const LIMIT_MS = 45 * 60_000;

function mainRoute(seed: number): { run: RunState; unlockAt: Map<string, number>; plays: number } {
  let run = createRun(seed, `main-${seed}`);
  const policies: Policy[] = [
    baselinePrimary,
    baselineBuyer,
    acknowledgeReveals,
    ...baselineCare,
    playEvery(),
  ];
  const unlockAt = new Map<string, number>();
  let plays = 0;
  while (run.activeMs < LIMIT_MS && !run.unlockedTechnologyIds.includes('autonomous-company')) {
    for (const policy of policies) {
      for (const command of policy({ run, catalog })) {
        const result = applyCommand(run, command, run.activeMs, catalog);
        if (command.type === 'startCatPlay' && result.result === 'applied') plays += 1;
        run = result.run;
      }
    }
    run = stepRun(run, 100, catalog).run;
    for (const id of run.unlockedTechnologyIds)
      if (!unlockAt.has(id)) unlockAt.set(id, run.activeMs);
    for (const value of Object.values(run.economy)) {
      if (!Number.isFinite(value) || value < 0) throw new Error(`invalid economy value ${value}`);
    }
  }
  return { run, unlockAt, plays };
}

describe('main automation route', () => {
  for (const seed of [101, 202]) {
    it(`reaches the autonomous company with ordinary commands (seed ${seed})`, () => {
      const { run, unlockAt, plays } = mainRoute(seed);
      const minutes = (unlockAt.get('autonomous-company') ?? Infinity) / 60_000;
      console.info(
        `seed ${seed}: autonomous company at ${minutes.toFixed(1)} active min, ${plays} PLAY sessions, cat ${run.cat.alive ? 'alive' : 'dead'}`,
      );
      expect(run.unlockedTechnologyIds).toEqual([...TECHNOLOGY_IDS]);
      expect(minutes).toBeLessThan(45);
      // Every technology entered History exactly once, in order.
      const history = run.history.flatMap((e) => (e.kind === 'technology' ? [e.id] : []));
      expect(history).toEqual([...TECHNOLOGY_IDS]);
      expect(plays).toBeGreaterThanOrEqual(5);
      expect(run.cat.alive).toBe(true);
      expect(run.status).toBe('playing');
    });
  }
});
