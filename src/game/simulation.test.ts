import { describe, expect, it } from 'vitest';
import { createTestCatalog } from '../../tests/helpers/catalog';
import { applyCommand } from './commands';
import { createRun } from './createRun';
import { stepRun } from './simulation';
import type { GameCommand } from './types';

const catalog = createTestCatalog();

describe('stepRun', () => {
  it('advances active time by one 100 ms step', () => {
    const run = createRun(1, 'r');
    const next = stepRun(run, 100, catalog).run;
    expect(next.activeMs).toBe(100);
    expect(run.activeMs).toBe(0);
  });

  it('leaves an ended run unchanged', () => {
    const run = { ...createRun(1, 'r'), status: 'ended' as const };
    expect(stepRun(run, 100, catalog).run).toBe(run);
  });

  it('turns queued manual work into output exactly once', () => {
    let run = applyCommand(createRun(1, 'r'), { type: 'primaryAction' }, 0, catalog).run;
    expect(run.stats.lifetimeOutput).toBe(0);
    run = stepRun(run, 100, catalog).run;
    expect(run.stats.lifetimeOutput).toBe(1);
    run = stepRun(run, 100, catalog).run;
    expect(run.stats.lifetimeOutput).toBe(1);
  });
});

describe('applyCommand', () => {
  it('rejects an unknown command as unavailable without throwing', () => {
    const run = createRun(1, 'r');
    const bogus = { type: 'mintMoney' } as unknown as GameCommand;
    const result = applyCommand(run, bogus, 0, catalog);
    expect(result.result).toBe('unavailable');
    expect(result.run).toBe(run);
  });

  it('rejects commands after the run ended', () => {
    const run = { ...createRun(1, 'r'), status: 'ended' as const };
    expect(applyCommand(run, { type: 'primaryAction' }, 0, catalog).result).toBe('unavailable');
  });

  it('lets one command see the result of the previous one', () => {
    const first = applyCommand(createRun(1, 'r'), { type: 'primaryAction' }, 0, catalog);
    const second = applyCommand(first.run, { type: 'primaryAction' }, 0, catalog);
    expect(first.result).toBe('applied');
    expect(second.run.economy.pendingManualWork).toBe(2);
  });
});
