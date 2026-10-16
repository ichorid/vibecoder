import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TECHNOLOGY_IDS } from '../../src/game/ids';
import { buildCatalog } from '../../src/music/core/catalog';
import { parseBinding, resolveBinding } from '../../src/music/binding';
import { readRepository } from '../../tools/music/sources';

const binding = parseBinding(JSON.parse(readFileSync('music/binding.json', 'utf8')));
const upTo = (id: (typeof TECHNOLOGY_IDS)[number]) =>
  TECHNOLOGY_IDS.slice(0, TECHNOLOGY_IDS.indexOf(id) + 1);
const resolve = (ids: readonly string[]) => resolveBinding(binding, ids, TECHNOLOGY_IDS);

describe('technology → music binding', () => {
  it('maps the progression to the six eras', () => {
    expect(resolve([])).toEqual({ era: 'discovery', arrangement: 'discovery-base' });
    expect(resolve(upTo('generated-snippets')).era).toBe('discovery');
    expect(resolve(upTo('terminal-agent')).era).toBe('acceleration');
    expect(resolve(upTo('parallel-agents')).era).toBe('orchestration');
    expect(resolve(upTo('custom-harness')).era).toBe('recursion');
    expect(resolve(upTo('self-improvement')).era).toBe('self-improvement');
    expect(resolve(upTo('autonomous-company')).era).toBe('singularity');
  });

  it('other milestones refine the arrangement inside an era', () => {
    expect(resolve(upTo('ai-native-ide'))).toEqual({
      era: 'discovery',
      arrangement: 'discovery-support',
    });
    expect(resolve(upTo('manager-agent'))).toEqual({
      era: 'orchestration',
      arrangement: 'orchestration-manager',
    });
    expect(resolve(upTo('meta-harness'))).toEqual({
      era: 'recursion',
      arrangement: 'recursion-meta',
    });
  });

  it('the same discovered IDs give the same result in any order, duplicates included', () => {
    const ids = upTo('custom-harness');
    const shuffled = [...ids].reverse();
    expect(resolve(shuffled)).toEqual(resolve(ids));
    expect(resolve([...ids, ...ids])).toEqual(resolve(ids));
  });

  it('every rule names a real technology, era and arrangement', () => {
    const { catalog } = buildCatalog(readRepository('music'));
    const known = new Set<string>(TECHNOLOGY_IDS);
    for (const rule of binding.rules) {
      expect(known.has(rule.technology), rule.technology).toBe(true);
      expect(catalog.eras.has(rule.era), rule.era).toBe(true);
      expect(catalog.arrangements.has(rule.arrangement), rule.arrangement).toBe(true);
    }
    expect(catalog.arrangements.has(binding.initial.arrangement)).toBe(true);
  });

  it('rejects malformed binding data', () => {
    expect(() => parseBinding({ schemaVersion: 1, initial: {}, rules: [] })).toThrow();
    expect(() => parseBinding({ schemaVersion: 2, initial: binding.initial, rules: [] })).toThrow();
  });
});
