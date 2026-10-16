import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import {
  act,
  AUTOCOMPLETE_PRICE,
  clickAndSettle,
  IDE_PRICE,
  SNIPPETS_PRICE,
  steps,
} from '../../tests/helpers/run';
import { applyCommand } from './commands';
import { createRun } from './createRun';
import { resolveDiscoveries } from './progression';
import { selectGame, selectHistory } from './selectors';
import type { RunState } from './types';

const SEED = 99;

function visibleText(run: RunState): string {
  return JSON.stringify([selectGame(run, catalog), selectHistory(run, catalog)]);
}

function buyAutocomplete(): RunState {
  const run = clickAndSettle(createRun(SEED, 'r'), AUTOCOMPLETE_PRICE, catalog);
  return act(run, { type: 'buyUpgrade', id: 'autocomplete' }, catalog);
}

function acknowledge(run: RunState): RunState {
  const id = run.pendingUnlockIds[0];
  if (!id) throw new Error('nothing pending');
  return act(run, { type: 'acknowledgeUnlock', id }, catalog);
}

describe('discovery and visibility', () => {
  it('never exposes a future technology before its prerequisites', () => {
    const run = clickAndSettle(createRun(SEED, 'r'), 200, catalog);
    const text = visibleText(run);
    expect(text).not.toContain('Generated snippets');
    expect(text).not.toContain('Generated Snippets');
    expect(text).not.toContain('AI-native IDE');
    expect(text).not.toContain('generated-snippets');
  });

  it('shows the first offer before its price is reached, and nothing else', () => {
    const run = clickAndSettle(createRun(SEED, 'r'), 5, catalog);
    const offers = selectGame(run, catalog).offers;
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      id: 'autocomplete',
      price: AUTOCOMPLETE_PRICE,
      affordable: false,
    });
  });

  it('hides offers at the very start', () => {
    expect(selectGame(createRun(SEED, 'r'), catalog).offers).toEqual([]);
  });

  it('applies the Autocomplete effect once with one history entry and one announcement', () => {
    const run = buyAutocomplete();
    expect(run.unlockedTechnologyIds).toEqual(['autocomplete']);
    expect(run.pendingUnlockIds).toEqual(['autocomplete']);
    expect(run.history.filter((e) => e.kind === 'technology')).toHaveLength(1);
    const after = clickAndSettle(run, 1, catalog);
    expect(after.economy.output - run.economy.output).toBe(2);
    expect(selectGame(run, catalog).announcement?.title).toBe('Autocomplete');
  });

  it('does not duplicate effects or history on re-resolution or repeated acknowledgement', () => {
    const run = buyAutocomplete();
    const again = resolveDiscoveries(run, catalog).run;
    expect(again.unlockedTechnologyIds).toEqual(['autocomplete']);
    expect(again.history).toHaveLength(run.history.length);
    const acked = acknowledge(again);
    expect(acked.pendingUnlockIds).toEqual([]);
    const twice = applyCommand(
      acked,
      { type: 'acknowledgeUnlock', id: 'autocomplete' },
      acked.activeMs,
      catalog,
    );
    expect(twice.result).toBe('unavailable');
    expect(twice.run).toBe(acked);
    expect(clickAndSettle(acked, 1, catalog).economy.output - acked.economy.output).toBe(2);
  });

  it('withholds the next progression offer until the discovery is acknowledged', () => {
    let run = clickAndSettle(buyAutocomplete(), 20, catalog);
    expect(selectGame(run, catalog).offers).toEqual([]);
    run = acknowledge(run);
    expect(selectGame(run, catalog).offers.map((o) => o.id)).toEqual(['generated-snippets']);
  });

  it('IDE adds 1 output per second and changes the primary action', () => {
    let run = acknowledge(buyAutocomplete());
    // Two code per press after Autocomplete, four after the snippets.
    run = clickAndSettle(run, Math.ceil(SNIPPETS_PRICE / 2), catalog);
    run = acknowledge(act(run, { type: 'buyUpgrade', id: 'generated-snippets' }, catalog));
    expect(selectGame(run, catalog).primaryAction.label).toBe('WRITE CODE');
    run = clickAndSettle(run, Math.ceil(IDE_PRICE / 4), catalog);
    run = act(run, { type: 'buyUpgrade', id: 'ai-native-ide' }, catalog);
    expect(selectGame(run, catalog).primaryAction.label).toBe('PROMPT');
    const before = run.economy.output;
    run = steps(run, 10, catalog);
    expect(run.economy.output - before).toBe(1);
  });
});
