import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { worldAdditions } from '../content/world';
import { withTechnologies } from '../../tests/helpers/unlock';
import { applyCommand } from '../game/commands';
import { createRun } from '../game/createRun';
import { activeEffects } from '../game/economy';
import type { TechnologyId } from '../game/ids';
import { selectGame } from '../game/selectors';
import { decodeRun } from './save';

const EARLY: readonly [TechnologyId, string][] = [
  ['terminal-agent', 'PROMPT'],
  ['autonomous-edits', 'PROMPT'],
  ['tool-permissions', 'PROMPT'],
  ['persistent-instructions', 'PROMPT'],
  ['ralph-loop', 'PROMPT'],
  ['reviewer', 'PROMPT'],
  ['parallel-agents', 'DELEGATE'],
  ['worktrees', 'DELEGATE'],
  ['manager-agent', 'SUPERVISE'],
];

const order = catalog.technologies.map((t) => t.id);

describe.each(EARLY)('transition to %s', (id, action) => {
  const index = order.indexOf(id);
  const before = order.slice(0, index);
  const upgrade = catalog.upgrades.find((u) => u.discovers === id);
  const technology = catalog.technologies.find((t) => t.id === id);
  if (!upgrade || !technology) throw new Error(`missing ${id}`);
  const base = withTechnologies(createRun(12, 'r'), before, catalog);

  it('is offered only after its prerequisite, before the price is reached', () => {
    const earlier = withTechnologies(createRun(12, 'r'), before.slice(0, -1), catalog);
    expect(selectGame(earlier, catalog).offers.map((o) => o.id)).not.toContain(id);
    const offer = selectGame(base, catalog).offers.find((o) => o.id === id);
    expect(offer).toMatchObject({ price: upgrade.basePrice, affordable: false });
    expect(selectGame(base, catalog).offers[0]?.id).toBe(id);
  });

  it('costs exactly its price and applies its effect once', () => {
    const rich = { ...base, economy: { ...base.economy, output: upgrade.basePrice } };
    const bought = applyCommand(rich, { type: 'buyUpgrade', id: upgrade.id }, 0, catalog);
    expect(bought.result).toBe('applied');
    expect(bought.run.economy.output).toBe(0);
    const owned = activeEffects(bought.run, catalog).filter((e) =>
      technology.effects.includes(e as never),
    );
    expect(owned).toHaveLength(technology.effects.length);
    expect(bought.run.history.filter((e) => e.kind === 'technology' && e.id === id)).toHaveLength(
      1,
    );
    expect(selectGame(bought.run, catalog).primaryAction.label).toBe(action);
    const again = applyCommand(bought.run, { type: 'buyUpgrade', id: upgrade.id }, 0, catalog);
    expect(again.result).toBe('unavailable');
  });

  it('has an authored world addition and survives a save roundtrip', () => {
    expect(
      worldAdditions.some((a) => a.technologyId === id && a.id === technology.worldAdditionId),
    ).toBe(true);
    const owned = withTechnologies(base, [id], catalog);
    expect(decodeRun(JSON.parse(JSON.stringify(owned)))).toEqual(owned);
  });
});
