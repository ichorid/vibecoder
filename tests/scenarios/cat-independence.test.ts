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
  playEvery,
  pressPrimary,
  runScenario,
} from '../helpers/scenario';

const economy = [every(1000, pressPrimary), buyFirstAffordable, acknowledgeReveals];
const THIRTY_MINUTES = 30 * 60_000;
/**
 * Cat food costs money by design (docs/feature_money.md §5.5); with free food the two runs must
 * be the same run, which proves care itself never helps production.
 */
const freeFood = {
  ...catalog,
  balance: { ...catalog.balance, rent: { ...catalog.balance.rent, foodPerFeed: 0 } },
};

describe('cat care is independent of productivity', () => {
  it('gives identical economies to a cared-for and a neglected cat', () => {
    const cared = runScenario(createRun(5, 'a'), freeFood, THIRTY_MINUTES, [
      ...economy,
      ...baselineCare,
      playEvery(),
    ]).run;
    const neglected = runScenario(createRun(5, 'b'), freeFood, THIRTY_MINUTES, economy).run;

    expect(cared.cat.alive).toBe(true);
    expect(neglected.cat.alive).toBe(false);

    expect(cared.economy).toEqual(neglected.economy);
    expect(cared.stats.lifetimeOutput).toBe(neglected.stats.lifetimeOutput);
    expect(cared.upgradeLevels).toEqual(neglected.upgradeLevels);
    expect(cared.unlockedTechnologyIds).toEqual(neglected.unlockedTechnologyIds);
    expect(deriveRates(cared, freeFood)).toEqual(deriveRates(neglected, freeFood));
    expect(selectGame(cared, freeFood).offers).toEqual(selectGame(neglected, freeFood).offers);
    expect(cared.rng.economy).toBe(neglected.rng.economy);
  }, 20_000);

  it('feeding costs money after moving out, and is never refused for it', async () => {
    const { act } = await import('../helpers/run');
    const run = createRun(5, 'food');
    const home = act(run, { type: 'feedCat' }, catalog);
    expect(home.economy.money).toBe(0);
    const broke = { ...run, rent: { ...run.rent, movedOut: true } };
    const fed = act(broke, { type: 'feedCat' }, catalog);
    expect(fed.stats.feeds).toBe(1);
    expect(fed.economy.money).toBe(-catalog.balance.rent.foodPerFeed);
  });
});
