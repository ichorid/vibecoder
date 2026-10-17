import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { act, steps } from '../../tests/helpers/run';
import { withTechnologies } from '../../tests/helpers/unlock';
import { createRun } from './createRun';
import { deriveRates } from './economy';
import type { RunState } from './types';

const AGENT_ERA = [
  'autocomplete',
  'generated-snippets',
  'ai-native-ide',
  'terminal-agent',
] as const;

function agentRun(patch: Partial<RunState['economy']> = {}): RunState {
  const run = withTechnologies(createRun(3, 'r'), AGENT_ERA, catalog);
  return { ...run, economy: { ...run.economy, ...patch } };
}

describe('the first agent', () => {
  // Plan start was 4 work/s, supply 2/s, 120 tokens; retuned in P07.5 (see progress notes).
  it('starts with one agent, one compute, 6 work/s, cost 1, supply 4/s and 150 tokens', () => {
    const run = agentRun();
    const rates = deriveRates(run, catalog);
    expect(rates.agents).toBe(1);
    expect(rates.compute).toBe(1);
    expect(rates.workPerAgentPerSecond).toBe(6);
    expect(rates.tokenCostPerWork).toBe(1);
    expect(rates.tokenSupplyPerSecond).toBe(4);
    expect(run.economy.tokens).toBe(150);
  });

  it('produces only with queued tasks and spends one token per work unit', () => {
    // The IDE's passive +1/s continues regardless; agent work is the difference.
    const idle = steps(agentRun({ tasks: 0 }), 10, catalog);
    expect(idle.stats.lifetimeOutput).toBeCloseTo(1, 6);
    const busy = steps(agentRun({ tasks: 40 }), 10, catalog);
    expect(busy.stats.lifetimeOutput - idle.stats.lifetimeOutput).toBeCloseTo(6, 6);
    // 150 + 4 supply − 6 spent.
    expect(busy.economy.tokens).toBeCloseTo(148, 6);
    expect(busy.economy.tasks).toBeCloseTo(39, 6);
  });

  it('does partial work on partial tokens and never goes negative', () => {
    const run = steps(agentRun({ tasks: 40, tokens: 1 }), 10, catalog);
    // 1 token + 4/s supply over 1 s funds 5 of the 6 possible work units (+1 IDE passive).
    expect(run.stats.lifetimeOutput).toBeCloseTo(5 + 1, 6);
    expect(run.economy.tokens).toBeGreaterThanOrEqual(0);
    expect(run.economy.tokens).toBeCloseTo(0, 6);
  });

  it('needs compute for each agent', () => {
    const run = agentRun({ tasks: 40 });
    const noCompute = { ...run, upgradeLevels: { ...run.upgradeLevels } };
    const rates = deriveRates(noCompute, catalog);
    expect(Math.min(rates.agents, rates.compute)).toBe(1);
  });

  it('keeps manual work free of token cost', () => {
    let run = agentRun({ tokens: 0, tasks: 0 });
    const manual = deriveRates(run, catalog).manualOutput;
    run = act(run, { type: 'primaryAction' }, catalog);
    run = steps(run, 1, catalog);
    // Manual output arrives in full; only the 0.4 supplied tokens fund 0.4 agent work.
    expect(run.stats.lifetimeOutput).toBeCloseTo(manual + 0.1 + 0.4, 6);
    expect(run.economy.tokens).toBeCloseTo(0, 6);
  });

  it('queues bounded agent tasks with PROMPT', () => {
    let run = agentRun({ tasks: 0 });
    for (let i = 0; i < 20; i += 1)
      run = steps(act(run, { type: 'primaryAction' }, catalog), 1, catalog);
    expect(run.economy.tasks).toBeLessThanOrEqual(catalog.balance.agents.taskQueueCap);
    expect(run.economy.tasks).toBeGreaterThan(30);
  });

  it('does not double capacity when rates are recomputed', () => {
    const run = agentRun();
    expect(deriveRates(run, catalog)).toEqual(deriveRates(run, catalog));
    expect(deriveRates(steps(run, 50, catalog), catalog).agents).toBe(1);
  });

  it('recovers from zero tokens without any purchase', () => {
    let run = agentRun({ tokens: 0, tasks: 40 });
    run = steps(run, 50, catalog);
    const before = run.stats.lifetimeOutput;
    run = steps(run, 50, catalog);
    expect(run.stats.lifetimeOutput - before).toBeGreaterThan(9);
  });

  it('caps manual presses with a refilling action budget', () => {
    let run = createRun(1, 'r');
    for (let i = 0; i < 40; i += 1) run = act(run, { type: 'primaryAction' }, catalog);
    run = steps(run, 1, catalog);
    expect(run.stats.lifetimeOutput).toBe(catalog.balance.actionBurst);
  });
});
