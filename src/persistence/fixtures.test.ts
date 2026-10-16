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
  untilChoice,
} from '../../tests/browser/fixtures';
import { createMemoryStorage } from '../../tests/helpers/memoryStorage';
import { createSaveAdapter, decodeSave, encodeSave, recoverProfile, SAVE_KEY } from './save';

const DIR = 'tests/fixtures/saves';

function endedRun() {
  const run = untilChoice('ship-original');
  return applyCommand(run, { type: 'choose', id: 'ship-original' }, run.activeMs, catalog).run;
}

const BUILDERS: Record<string, () => string> = {
  'v1-fresh': () => saveWithProfile(createRun(1, 'fixture-fresh'), []),
  'v1-midgame': () => saveWithProfile(progressedRun(6, true), []),
  'v1-dead-cat': () => saveWithProfile(neglectedRun(), []),
  'v1-ended': () => {
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

describe('released save fixtures (schema 1)', () => {
  for (const name of Object.keys(BUILDERS)) {
    it(`${name} loads through the explicit mapping and re-encodes byte for byte`, () => {
      const text = fixture(name);
      expect(encodeSave(loaded(text))).toBe(text);
    });
  }

  it('mid-game keeps RNG streams, the pending reveal and care cooldowns', () => {
    const save = loaded(fixture('v1-midgame'));
    const original = JSON.parse(fixture('v1-midgame')) as { run: { rng: unknown } };
    expect(save.run.rng).toEqual(original.run.rng);
    expect(save.run.pendingUnlockIds.length).toBeGreaterThan(0);
    expect(save.run.cat.lastFedAtActiveMs).not.toBeNull();
  });

  it('a dead cat stays dead and an ended run stays ended', () => {
    const dead = loaded(fixture('v1-dead-cat'));
    expect(dead.run.cat.alive).toBe(false);
    expect(dead.run.history.some((h) => h.kind === 'cat' && h.id === 'cat-died')).toBe(true);
    const ended = loaded(fixture('v1-ended'));
    expect(ended.run.status).toBe('ended');
    expect(ended.run.ending?.id).toBe('three-users');
    expect(ended.profile.endings.map((e) => e.id)).toEqual(['three-users']);
  });

  it('a future schema, unknown IDs or out-of-range values are refused and never overwritten', () => {
    const base = JSON.parse(fixture('v1-midgame')) as Record<string, unknown> & {
      run: Record<string, unknown> & { cat: Record<string, unknown> };
    };
    const cases: [string, unknown, string][] = [
      ['future', { ...base, schemaVersion: 2 }, 'unsupported'],
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
    const ended = JSON.parse(fixture('v1-ended')) as Record<string, unknown>;
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
