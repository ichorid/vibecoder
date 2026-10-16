import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { applyCommand } from './commands';
import { createRun } from './createRun';
import { demoPrice, demoText, nextDemo } from './demos';
import type { TechnologyId } from './ids';
import { selectGame, selectHistory } from './selectors';
import { stepRun } from './simulation';
import type { RunState } from './types';

function withTechnologies(ids: readonly TechnologyId[], output = 1e9): RunState {
  const run = createRun(7, 'demo-test');
  return {
    ...run,
    unlockedTechnologyIds: [...ids],
    upgradeLevels: Object.fromEntries(ids.map((id) => [id, 1])),
    economy: { ...run.economy, output },
    stats: { ...run.stats, lifetimeOutput: output },
  };
}
const make = (run: RunState) => applyCommand(run, { type: 'makeDemo' }, run.activeMs, catalog);
const ready = () => withTechnologies(['autocomplete', catalog.demos.availableFrom]);

describe('coding a demo', () => {
  it('is on offer once the project works, never before, never after the end', () => {
    expect(nextDemo(withTechnologies(['autocomplete']), catalog)).toBeNull();
    expect(nextDemo(ready(), catalog)).toMatchObject({ number: 1, price: catalog.demos.basePrice });
    expect(nextDemo({ ...ready(), status: 'ended' }, catalog)).toBeNull();
    expect(make(withTechnologies(['autocomplete'])).result).toBe('unavailable');
  });

  it('costs its price (never all your code), and each next one costs more', () => {
    const rich = ready();
    const first = make(rich);
    expect(first.result).toBe('applied');
    expect(first.run.economy.output).toBe(rich.economy.output - catalog.demos.basePrice);
    expect(nextDemo(first.run, catalog)?.price).toBe(demoPrice(catalog.demos, 2));
    expect(demoPrice(catalog.demos, 2)).toBeGreaterThan(demoPrice(catalog.demos, 1));
    const poor = withTechnologies(['autocomplete', catalog.demos.availableFrom], 10);
    expect(make(poor).result).toBe('unaffordable');
  });

  it('records a seed from its own stream, the cat, a log line, history and a fact', () => {
    const run = ready();
    const { run: after, facts } = make(run);
    expect(after.demos).toHaveLength(1);
    expect(after.demos[0]).toMatchObject({ number: 1, catAlive: true, activeMs: run.activeMs });
    expect(after.rng.demo).not.toBe(run.rng.demo);
    expect({ ...after.rng, demo: run.rng.demo }).toEqual(run.rng); // no other stream moves
    expect(after.history.at(-1)).toEqual({ kind: 'demo', number: 1, activeMs: run.activeMs });
    const record = after.demos[0];
    if (!record) throw new Error('no demo recorded');
    expect(after.log.at(-1)?.text).toContain(demoText(record, catalog).title);
    expect(facts).toEqual([{ type: 'demoMade', number: 1 }]);
    // the economy does not notice (cosmetic): same rates, only the code went
    expect(after.economy).toEqual({
      ...run.economy,
      output: run.economy.output - catalog.demos.basePrice,
    });
  });

  it('the same run makes the same demos whenever they are made', () => {
    const a = make(ready()).run;
    const later = { ...ready(), activeMs: 900_000 };
    const b = make(later).run;
    expect(b.demos[0]?.seed).toBe(a.demos[0]?.seed);
  });

  it('titles, groups and greetings come from the seed, and the cat only while it is there', () => {
    const record = { number: 3, seed: 12345, catAlive: true, activeMs: 0 };
    const text = demoText(record, catalog);
    expect(text).toEqual(demoText(record, catalog));
    expect(text.title.length).toBeGreaterThan(3);
    expect(text.greetings.length).toBeGreaterThanOrEqual(3);
    for (let seed = 1; seed < 200; seed++) {
      const gone = demoText({ ...record, seed, catAlive: false }, catalog);
      expect([...gone.greetings, ...gone.scroller].join(' ')).not.toMatch(/\bcat\b/i);
    }
  });

  it('the Game view offers the strip and lists the demos; History can replay them', () => {
    const run = make(ready()).run;
    const game = selectGame(run, catalog);
    expect(game.demo).toMatchObject({ number: 2, affordable: true });
    expect(game.demos).toHaveLength(1);
    expect(game.demos[0]?.seeds).toEqual([run.demos[0]?.seed]);
    const entry = selectHistory(run, catalog).entries.at(-1);
    expect(entry).toMatchObject({ kind: 'demo', demo: 1, icon: { kind: 'symbol', id: 'demo' } });
  });

  it('logs once, the first time a demo is affordable', () => {
    let run = withTechnologies([catalog.demos.availableFrom], 10);
    run = stepRun(run, 100, catalog).run;
    expect(run.log.filter((l) => l.text.startsWith('💾'))).toHaveLength(0);
    run = { ...run, economy: { ...run.economy, output: 1e9 } };
    run = stepRun(run, 100, catalog).run;
    run = stepRun(run, 100, catalog).run;
    expect(run.log.filter((l) => l.text.startsWith('💾'))).toHaveLength(1);
  });
});
