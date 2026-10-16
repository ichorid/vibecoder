import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { cardEffects } from './effectText';
import { createRun } from './createRun';
import { selectGame } from './selectors';

const upgrade = (id: string) => {
  const found = catalog.upgrades.find((u) => u.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe('card effect lines', () => {
  it('describe repeatable cards from their per-level effects', () => {
    expect(cardEffects(upgrade('compute-slot'), catalog)).toEqual(['+1 compute']);
    expect(cardEffects(upgrade('review-capacity'), catalog)).toEqual(['−0.5 debt/s']);
    expect(cardEffects(upgrade('additional-agent'), catalog)).toEqual([
      '+1 agent',
      'needs 1 compute, 1 managed',
    ]);
  });

  it('describe a technology card from the technology it unlocks, including a new action', () => {
    expect(cardEffects(upgrade('autocomplete'), catalog)).toEqual(['+1 code per press']);
    expect(cardEffects(upgrade('ai-native-ide'), catalog)).toEqual([
      '+1 code/s',
      'action → PROMPT',
    ]);
    expect(cardEffects(upgrade('context-management'), catalog)).toEqual([
      '+12 work/s per agent',
      'token cost ×0.7',
      '+30 tokens/s',
    ]);
  });

  it('explain the special cards', () => {
    expect(cardEffects(upgrade('auto-refill-v1'), catalog)).toEqual([
      'buys tokens when they run out',
      'has a bug',
    ]);
    expect(cardEffects(upgrade('auto-reviewer'), catalog)).toEqual([
      '+2% tokens per code every 30 s (up to +50%)',
    ]);
  });

  it('every card on offer carries its effect line', () => {
    const run = createRun(1, 'r');
    const rich = { ...run, stats: { ...run.stats, lifetimeOutput: 10 } };
    const card = selectGame(rich, catalog).offers.find((o) => o.id === 'autocomplete');
    expect(card?.kind === 'upgrade' && card.effects).toEqual(['+1 code per press']);
    for (const definition of catalog.upgrades) {
      if (definition.pack) continue;
      expect(cardEffects(definition, catalog).length, definition.id).toBeGreaterThan(0);
    }
  });
});
