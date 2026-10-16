import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { createMemoryStorage } from '../../tests/helpers/memoryStorage';
import { act, clickAndSettle } from '../../tests/helpers/run';
import { createRun } from '../game/createRun';
import type { RunState } from '../game/types';
import {
  CURRENT_SCHEMA_VERSION,
  SAVE_KEY,
  createProfile,
  createSaveAdapter,
  decodeSave,
  encodeSave,
  type SaveData,
} from './save';

function progressedRun(): RunState {
  const run = clickAndSettle(createRun(5, 'run-a'), 12, catalog);
  return act(run, { type: 'buyUpgrade', id: 'autocomplete' }, catalog);
}

function envelope(run: RunState = progressedRun()): SaveData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contentVersion: 1,
    revision: 3,
    profile: { ...createProfile(), theme: 'dark' },
    run,
  };
}

function roundtrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

function corrupt(mutate: (raw: Record<string, unknown>) => void): unknown {
  const raw = roundtrip(envelope()) as Record<string, unknown>;
  mutate(raw);
  return raw;
}

describe('save envelope', () => {
  it('roundtrips run, RNG, pending unlocks and profile', () => {
    const save = envelope();
    const result = decodeSave(JSON.parse(encodeSave(save)));
    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.save.run).toEqual(save.run);
    expect(result.save.run.pendingUnlockIds).toEqual(['autocomplete']);
    expect(result.save.run.rng).toEqual(save.run.rng);
    expect(result.save.profile.theme).toBe('dark');
  });

  it('writes no presentation state', () => {
    const text = encodeSave(envelope());
    expect(Object.keys(JSON.parse(text) as object).sort()).toEqual(
      ['contentVersion', 'profile', 'revision', 'run', 'schemaVersion'].sort(),
    );
    expect(text).not.toMatch(/"view"|"camera"|"pointer"|"canvas"/);
  });

  it.each([
    ['not an object', () => 'hello'],
    [
      'NaN output',
      () => corrupt((r) => ((r.run as { economy: { output: unknown } }).economy.output = 'NaN')),
    ],
    [
      'infinite output',
      () =>
        corrupt(
          (r) =>
            ((r.run as { economy: { output: number } }).economy.output = Number.POSITIVE_INFINITY),
        ),
    ],
    [
      'negative output',
      () => corrupt((r) => ((r.run as { economy: { output: number } }).economy.output = -1)),
    ],
    [
      'mood above range',
      () => corrupt((r) => ((r.run as { cat: { mood: number } }).cat.mood = 101)),
    ],
    [
      'unknown technology',
      () =>
        corrupt(
          (r) =>
            ((r.run as { unlockedTechnologyIds: string[] }).unlockedTechnologyIds = ['warp-drive']),
        ),
    ],
    [
      'unknown upgrade',
      () => corrupt((r) => ((r.run as { upgradeLevels: object }).upgradeLevels = { teleport: 1 })),
    ],
    ['missing run', () => corrupt((r) => delete r.run)],
  ])('rejects %s', (_label, make) => {
    expect(decodeSave(make()).status).toBe('corrupt');
  });

  it('rejects a future schema version as unsupported', () => {
    const result = decodeSave(corrupt((r) => (r.schemaVersion = CURRENT_SCHEMA_VERSION + 1)));
    expect(result.status).toBe('unsupported');
  });

  it('rejects a dead cat without a death fact and a living cat with one', () => {
    expect(
      decodeSave(corrupt((r) => ((r.run as { cat: { alive: boolean } }).cat.alive = false))).status,
    ).toBe('corrupt');
    expect(
      decodeSave(
        corrupt((r) => ((r.run as { cat: { diedAtActiveMs: number } }).cat.diedAtActiveMs = 5)),
      ).status,
    ).toBe('corrupt');
  });

  it('keeps a dead cat dead through decoding', () => {
    const run = progressedRun();
    const dead: RunState = {
      ...run,
      cat: { ...run.cat, alive: false, health: 0, diedAtActiveMs: 900 },
    };
    const result = decodeSave(roundtrip(envelope(dead)));
    expect(result.status === 'loaded' && result.save.run.cat.alive).toBe(false);
  });

  it('ignores wall-clock metadata: a save opened much later is unchanged', () => {
    const save = envelope();
    const old = { ...(roundtrip(save) as object), savedAtWallMs: 1 };
    const result = decodeSave(old);
    expect(result.status === 'loaded' && result.save.run).toEqual(save.run);
  });
});

describe('save adapter', () => {
  it('reports an empty slot without inventing a run', () => {
    expect(createSaveAdapter(createMemoryStorage()).load().status).toBe('empty');
  });

  it('preserves a broken save untouched until the player decides', () => {
    const storage = createMemoryStorage({ [SAVE_KEY]: '{"schemaVersion":1,"run":' });
    const adapter = createSaveAdapter(storage);
    const result = adapter.load();
    expect(result.status).toBe('corrupt');
    expect(result.status === 'corrupt' && result.raw).toBe('{"schemaVersion":1,"run":');
    expect(storage.getItem(SAVE_KEY)).toBe('{"schemaVersion":1,"run":');
    expect(storage.writes).toBe(0);
  });

  it('writes one envelope and reads it back', () => {
    const storage = createMemoryStorage();
    const adapter = createSaveAdapter(storage);
    expect(adapter.write(envelope())).toEqual({ ok: true });
    const result = adapter.load();
    expect(result.status === 'loaded' && result.save.revision).toBe(3);
  });

  it('returns a typed failure instead of throwing on quota errors', () => {
    const storage = createMemoryStorage();
    storage.failWrites = true;
    expect(createSaveAdapter(storage).write(envelope()).ok).toBe(false);
  });
});
