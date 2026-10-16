import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { steps } from '../../tests/helpers/run';
import { withTechnologies } from '../../tests/helpers/unlock';
import type { Catalog, EventDefinition } from './catalog';
import { createRun } from './createRun';
import { evaluateNarrative } from './narrative';
import { selectHistory } from './selectors';
import type { RunState } from './types';

function withEvents(events: readonly EventDefinition[]): Catalog {
  return { ...catalog, events };
}

const once: EventDefinition = {
  id: 'test-once',
  emoji: '🧪',
  text: 'Once.',
  once: true,
  when: () => true,
};
const repeating: EventDefinition = {
  id: 'test-repeat',
  emoji: '🧪',
  text: 'Again.',
  cooldownMs: 10_000,
  when: () => true,
};

describe('narrative events', () => {
  it('fires a once-per-run event exactly once', () => {
    const cat = withEvents([once]);
    let run = createRun(1, 'r');
    for (let i = 0; i < 20; i += 1) run = evaluateNarrative(run, cat, []);
    expect(run.log.filter((l) => l.text === '🧪 Once.')).toHaveLength(1);
  });

  it('respects a cooldown instead of repeating every tick', () => {
    const cat = withEvents([repeating]);
    let run = createRun(1, 'r');
    for (let i = 0; i < 250; i += 1) {
      run = evaluateNarrative({ ...run, activeMs: i * 100 }, cat, []);
    }
    expect(run.log.filter((l) => l.text === '🧪 Again.')).toHaveLength(3);
  });

  it('stays quiet in a step that recorded a discovery or the death', () => {
    const cat = withEvents([once]);
    const run = createRun(1, 'r');
    expect(evaluateNarrative(run, cat, [{ type: 'catDied' }]).log).toHaveLength(0);
    expect(
      evaluateNarrative(run, cat, [{ type: 'technologyDiscovered', id: 'autocomplete' }]).log,
    ).toHaveLength(0);
  });

  it('records significant events once in History and keeps the log bounded', () => {
    const significant: EventDefinition = {
      ...once,
      id: 'test-big',
      text: 'Big.',
      significant: true,
    };
    const cat = withEvents([significant, repeating]);
    let run: RunState = createRun(1, 'r');
    for (let i = 0; i < 2000; i += 1)
      run = evaluateNarrative({ ...run, activeMs: i * 1000 }, cat, []);
    expect(run.history.filter((e) => e.kind === 'event')).toHaveLength(1);
    expect(selectHistory(run, cat).entries.map((e) => e.title)).toContain('Big.');
    expect(run.log.length).toBeLessThanOrEqual(catalog.balance.logMemoryLimit);
  });

  it('ships early jokes that the real simulation triggers', () => {
    const run = withTechnologies(
      createRun(2, 'r'),
      ['autocomplete', 'generated-snippets', 'ai-native-ide', 'terminal-agent'],
      catalog,
    );
    const dry = steps({ ...run, economy: { ...run.economy, tokens: 0, tasks: 40 } }, 30, catalog);
    expect(dry.log.some((l) => /waiting for tokens/i.test(l.text))).toBe(true);
  });
});
