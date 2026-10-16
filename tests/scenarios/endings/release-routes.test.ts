/**
 * The Infinite Weekend: reached only by the release jackpot. The route uses public commands from
 * `createRun`; seed 1868 was found by searching the release stream for a win at v0.1 (0.2 %).
 */
import { describe, expect, it } from 'vitest';
import { catalog } from '../../../src/content/catalog';
import { applyCommand } from '../../../src/game/commands';
import { createRun } from '../../../src/game/createRun';
import { selectGame } from '../../../src/game/selectors';
import type { TechnologyId } from '../../../src/game/ids';
import type { RunState } from '../../../src/game/types';
import {
  acknowledgeReveals,
  baselineBuyer,
  baselineCare,
  baselinePrimary,
  playEvery,
  savingForReleases,
  shipWhenAffordable,
  type Policy,
} from '../../helpers/scenario';
import { expectEnding, newRun, playUntil } from '../../helpers/endingRoute';

const shipper: Policy[] = [
  baselinePrimary,
  shipWhenAffordable,
  savingForReleases(baselineBuyer),
  acknowledgeReveals,
  ...baselineCare,
  playEvery(),
];

describe('The Infinite Weekend', () => {
  it('a release lands on the gold slice and the run ends on the beach (seed 1868)', () => {
    const run = playUntil(newRun(1868), shipper, (r) => r.status === 'ended');
    expectEnding(run, 'the-infinite-weekend');
    expect(run.releases).toEqual([expect.objectContaining({ window: 1, outcome: 'jackpot' })]);
    expect(selectGame(run, catalog).ending?.illustrationId).toBe(
      run.ending?.catAlive ? 'ending-infinite-weekend' : 'ending-infinite-weekend-nocat',
    );
  });

  it('a player who ships every window wins 20 % of runs (statistical, real draw code)', () => {
    const windows: TechnologyId[] = [catalog.releases.availableFrom];
    const RUNS = 5000;
    let wins = 0;
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const fresh = createRun(seed, `stat-${seed}`);
      let run: RunState = {
        ...fresh,
        unlockedTechnologyIds: windows,
        history: windows.map((id) => ({ kind: 'technology' as const, id, activeMs: 0 })),
        economy: { ...fresh.economy, output: 1e12 },
      };
      for (let k = 0; k < 5 && run.status === 'playing'; k += 1) {
        run = { ...run, economy: { ...run.economy, output: 1e12 } };
        run = applyCommand(run, { type: 'shipRelease' }, 0, catalog).run;
      }
      if (run.ending?.id === 'the-infinite-weekend') wins += 1;
    }
    expect(wins / RUNS).toBeGreaterThan(0.18);
    expect(wins / RUNS).toBeLessThan(0.22);
  });
});
