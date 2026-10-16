import { describe, expect, it } from 'vitest';
import { catalog } from '../../src/content/catalog';
import { createRun } from '../../src/game/createRun';
import { deriveRates } from '../../src/game/economy';
import { selectGame } from '../../src/game/selectors';
import {
  acknowledgeReveals,
  baselineCare,
  buyFirstAffordable,
  every,
  pressPrimary,
  runScenario,
} from '../helpers/scenario';

const economy = [every(1000, pressPrimary), buyFirstAffordable, acknowledgeReveals];
const THIRTY_MINUTES = 30 * 60_000;

describe('cat care is independent of productivity', () => {
  it('gives identical economies to a cared-for and a neglected cat', () => {
    const cared = runScenario(createRun(5, 'a'), catalog, THIRTY_MINUTES, [
      ...economy,
      ...baselineCare,
    ]).run;
    const neglected = runScenario(createRun(5, 'b'), catalog, THIRTY_MINUTES, economy).run;

    expect(cared.cat.alive).toBe(true);
    expect(neglected.cat.alive).toBe(false);

    expect(cared.economy).toEqual(neglected.economy);
    expect(cared.stats.lifetimeOutput).toBe(neglected.stats.lifetimeOutput);
    expect(cared.upgradeLevels).toEqual(neglected.upgradeLevels);
    expect(cared.unlockedTechnologyIds).toEqual(neglected.unlockedTechnologyIds);
    expect(deriveRates(cared, catalog)).toEqual(deriveRates(neglected, catalog));
    expect(selectGame(cared, catalog).offers).toEqual(selectGame(neglected, catalog).offers);
    expect(cared.rng.economy).toBe(neglected.rng.economy);
  });
});
