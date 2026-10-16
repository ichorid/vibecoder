/**
 * Released save formats. Schema 1 is the first released format, so its fixtures are real saves
 * produced by real game paths (fresh, mid-game with a pending reveal and cooldowns, a dead cat,
 * an ended run). Each must load and re-encode byte for byte. When the format changes, keep these
 * files and add a migration plus new fixtures — never edit an old one.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { createRun } from '../game/createRun';
import { applyCommand } from '../game/commands';
import {
  neglectedRun,
  progressedRun,
  saveWithProfile,
  strayRun,
  untilChoice,
} from '../../tests/browser/fixtures';
import { createMemoryStorage } from '../../tests/helpers/memoryStorage';
import { TOKENS_PER_OLD_SUPPLY_LEVEL } from './migrations';
import {
  createSaveAdapter,
  CURRENT_SCHEMA_VERSION,
  decodeSave,
  encodeSave,
  recoverProfile,
  SAVE_KEY,
} from './save';

const DIR = 'tests/fixtures/saves';

function endedRun() {
  const run = untilChoice('ship-original');
  return applyCommand(run, { type: 'choose', id: 'ship-original' }, run.activeMs, catalog).run;
}

/** Current-format fixtures (schema 3), produced by the same real game paths. */
const BUILDERS: Record<string, () => string> = {
  'v3-fresh': () => saveWithProfile(createRun(1, 'fixture-fresh'), []),
  'v3-midgame': () => saveWithProfile(progressedRun(6, true), []),
  'v3-dead-cat': () => saveWithProfile(neglectedRun(), []),
  'v3-stray-cat': () => saveWithProfile(strayRun(), []),
  'v3-ended': () => {
    const run = endedRun();
    return saveWithProfile(run, [
      { id: 'three-users', runId: run.id, activeMs: run.activeMs, order: 1 },
    ]);
  },
};

function fixture(name: string): string {
  const file = `${DIR}/${name}.json`;
  if (process.env.UPDATE_FIXTURES) writeFileSync(file, BUILDERS[name]?.() ?? '');
  return readFileSync(file, 'utf8');
}

function loaded(text: string) {
  const result = decodeSave(JSON.parse(text) as unknown, text);
  if (result.status !== 'loaded')
    throw new Error(`${result.status}: ${'reason' in result ? result.reason : ''}`);
  return result.save;
}

const V1 = ['v1-fresh', 'v1-midgame', 'v1-dead-cat', 'v1-ended'] as const;
const V2 = ['v2-fresh', 'v2-midgame', 'v2-dead-cat', 'v2-ended'] as const;
const file = (name: string) => readFileSync(`${DIR}/${name}.json`, 'utf8');

describe('released save fixtures', () => {
  for (const name of Object.keys(BUILDERS)) {
    it(`${name} (current schema) loads and re-encodes byte for byte`, () => {
      const text = fixture(name);
      expect(encodeSave(loaded(text))).toBe(text);
    });
  }

  for (const name of V1) {
    it(`${name} migrates to the current schema through the explicit mapping`, () => {
      const save = loaded(file(name));
      expect(save.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(save.run.economy).toMatchObject({
        autoRefills: 0,
        tokenReviewBonus: 0,
        autoReviewMs: 0,
      });
      expect(save.run.stats.refillDisasters).toBe(0);
    });
  }

  for (const name of [...V1, ...V2]) {
    it(`${name} gets a cat that has never left (2 → 3)`, () => {
      const save = loaded(file(name));
      expect(save.run.cat.leftAtActiveMs).toBeNull();
      expect(save.run.cat.ignoredMs).toBe(0);
      if (save.run.ending) expect(save.run.ending.catLeft).toBe(false);
      const raw = JSON.parse(file(name)) as { run: { cat: Record<string, unknown> } };
      expect(save.run.cat.alive).toBe(raw.run.cat.alive);
    });
  }

  it('a stray cat stays gone and is not mistaken for a dead one', () => {
    const stray = loaded(fixture('v3-stray-cat'));
    expect(stray.run.cat.alive).toBe(false);
    expect(stray.run.cat.leftAtActiveMs).not.toBeNull();
    expect(stray.run.cat.diedAtActiveMs).toBeNull();
    expect(stray.run.cat.health).toBeGreaterThan(0);
    expect(stray.run.history.some((h) => h.kind === 'cat' && h.id === 'cat-left')).toBe(true);
  });

  it('v1 → v2 turns each old "+6 tokens/s" level into a one-time token grant', () => {
    const raw = JSON.parse(file('v1-midgame')) as {
      run: { economy: { tokens: number }; upgradeLevels: Record<string, number> };
    };
    const levels = raw.run.upgradeLevels['token-supply'] ?? 0;
    expect(levels).toBeGreaterThan(0);
    const save = loaded(file('v1-midgame'));
    expect(save.run.upgradeLevels['token-supply']).toBeUndefined();
    expect(save.run.economy.tokens).toBe(
      raw.run.economy.tokens + levels * TOKENS_PER_OLD_SUPPLY_LEVEL,
    );
    expect(save.run.rng).toEqual(
      (JSON.parse(file('v1-midgame')) as { run: { rng: unknown } }).run.rng,
    );
  });

  it('mid-game keeps RNG streams, the pending reveal and care cooldowns', () => {
    const save = loaded(fixture('v3-midgame'));
    const original = JSON.parse(fixture('v3-midgame')) as { run: { rng: unknown } };
    expect(save.run.rng).toEqual(original.run.rng);
    expect(save.run.pendingUnlockIds.length).toBeGreaterThan(0);
    expect(save.run.cat.lastFedAtActiveMs).not.toBeNull();
  });

  it('a dead cat stays dead and an ended run stays ended', () => {
    const dead = loaded(fixture('v3-dead-cat'));
    expect(dead.run.cat.alive).toBe(false);
    expect(dead.run.history.some((h) => h.kind === 'cat' && h.id === 'cat-died')).toBe(true);
    const ended = loaded(fixture('v3-ended'));
    expect(ended.run.status).toBe('ended');
    expect(ended.run.ending?.id).toBe('three-users');
    expect(ended.profile.endings.map((e) => e.id)).toEqual(['three-users']);
  });

  it('a future schema, unknown IDs or out-of-range values are refused and never overwritten', () => {
    const base = JSON.parse(fixture('v3-midgame')) as Record<string, unknown> & {
      run: Record<string, unknown> & { cat: Record<string, unknown> };
    };
    const cases: [string, unknown, string][] = [
      ['future', { ...base, schemaVersion: CURRENT_SCHEMA_VERSION + 1 }, 'unsupported'],
      [
        'unknown technology',
        { ...base, run: { ...base.run, unlockedTechnologyIds: ['time-machine'] } },
        'corrupt',
      ],
      [
        'fullness 150',
        { ...base, run: { ...base.run, cat: { ...base.run.cat, fullness: 150 } } },
        'corrupt',
      ],
      [
        'present cat with a leaving time',
        { ...base, run: { ...base.run, cat: { ...base.run.cat, leftAtActiveMs: 1000 } } },
        'corrupt',
      ],
      [
        'cat both dead and gone',
        {
          ...base,
          run: {
            ...base.run,
            cat: {
              ...base.run.cat,
              alive: false,
              health: 0,
              diedAtActiveMs: 1000,
              leftAtActiveMs: 1000,
            },
          },
        },
        'corrupt',
      ],
    ];
    for (const [label, value, status] of cases) {
      const text = JSON.stringify(value);
      const storage = createMemoryStorage({ [SAVE_KEY]: text });
      expect(createSaveAdapter(storage).load().status, label).toBe(status);
      expect(storage.getItem(SAVE_KEY), label).toBe(text);
    }
  });
});

describe('profile recovery from an unreadable save', () => {
  it('keeps discovered endings only when the profile validates on its own', () => {
    const ended = JSON.parse(file('v1-ended')) as Record<string, unknown>;
    const brokenRun = JSON.stringify({ ...ended, run: { nonsense: true } });
    expect(recoverProfile(brokenRun)?.endings.map((e) => e.id)).toEqual(['three-users']);
    const brokenProfile = JSON.stringify({
      ...ended,
      profile: { theme: 'neon', endings: 'all of them' },
    });
    expect(recoverProfile(brokenProfile)).toBeNull();
    expect(recoverProfile('{not json')).toBeNull();
    expect(
      recoverProfile(
        JSON.stringify({
          ...ended,
          profile: {
            theme: 'dark',
            endings: [{ id: 'made-up', runId: 'x', activeMs: 1, order: 1 }],
          },
        }),
      ),
    ).toBeNull();
  });
});
