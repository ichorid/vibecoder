import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { act, steps } from '../../tests/helpers/run';
import { withTechnologies } from '../../tests/helpers/unlock';
import type { AchievementDefinition, Catalog } from './catalog';
import { createRun } from './createRun';
import { deriveRates } from './economy';
import { evaluateAchievements } from './narrative';
import { selectHistory } from './selectors';

const always: AchievementDefinition = { id: 'test-always', title: 'Always', when: () => true };
const withAchievements = (achievements: readonly AchievementDefinition[]): Catalog => ({
  ...catalog,
  achievements,
});

describe('achievements', () => {
  it('records an achievement once, in History, without a bonus', () => {
    const cat = withAchievements([always]);
    let run = createRun(1, 'r');
    const rates = deriveRates(run, cat);
    for (let i = 0; i < 5; i += 1) run = evaluateAchievements(run, cat);
    expect(run.achievementIds).toEqual(['test-always']);
    expect(run.history.filter((e) => e.kind === 'achievement')).toHaveLength(1);
    expect(deriveRates(run, cat)).toEqual(rates);
    expect(selectHistory(run, cat).entries.at(-1)?.title).toBe('Always');
  });

  it('never exposes locked achievements or a total count', () => {
    const run = createRun(1, 'r');
    const text = JSON.stringify(selectHistory(run, catalog));
    for (const achievement of catalog.achievements) expect(text).not.toContain(achievement.title);
    expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
  });

  it('counts care in statistics that never feed production', () => {
    let run = createRun(1, 'r');
    run = act(run, { type: 'petCat' }, catalog);
    run = { ...run, cat: { ...run.cat, fullness: 40 } };
    run = act(run, { type: 'feedCat' }, catalog);
    expect(run.stats.pets).toBe(1);
    expect(run.stats.feeds).toBe(1);
  });

  it('ships real achievements reached by ordinary play', () => {
    const run = withTechnologies(
      createRun(3, 'r'),
      ['autocomplete', 'generated-snippets', 'ai-native-ide', 'terminal-agent'],
      catalog,
    );
    const later = steps(run, 20, catalog);
    expect(later.achievementIds.length).toBeGreaterThan(0);
  });
});
