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
import type { GameCommand, RunState } from '../game/types';
import { applyCommand } from '../game/commands';
import { nextDemo } from '../game/demos';
import { stepRun } from '../game/simulation';
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
  const run = untilChoice('archive-original');
  return applyCommand(run, { type: 'choose', id: 'archive-original' }, run.activeMs, catalog).run;
}

/** Code built into the next release or demo (fixture shortcut: the price, ready to go). */
function built(run: RunState, key: 'release' | 'demo', price: number): RunState {
  return { ...run, projects: { ...run.projects, [key]: { code: price, price } } };
}

/** A run that has shipped its first release (window 1, at the Terminal Agent). */
function shippedRun() {
  const run = built(progressedRun(4, false), 'release', 2000);
  return applyCommand(run, { type: 'shipRelease' }, run.activeMs, catalog).run;
}

/** A run that has shipped v0.1, coded two demos (the second designed) and designed a third. */
function demoRun() {
  const act = (run: RunState, command: GameCommand) =>
    applyCommand(run, command, run.activeMs, catalog).run;
  const demo = (r: RunState) => built(r, 'demo', nextDemo(r, catalog)?.price ?? 0);
  let run = shippedRun();
  run = act(demo(run), { type: 'makeDemo' });
  run = act(run, { type: 'designDemo', pick: 2 });
  run = act(demo(run), { type: 'makeDemo' });
  return act(run, { type: 'designDemo', pick: 3 });
}

/**
 * A run on its own: gigs paid, rent due, a missed month with its landlord wheel, and the
 * enterprise job's tryout under way (the baseline route, then a broke month and a hire).
 */
function moneyRun() {
  let run = progressedRun(8, false);
  // A broke month: spend everything, then let the rent come due.
  run = { ...run, economy: { ...run.economy, money: 0 } };
  const due = run.rent.nextDueMs ?? run.activeMs;
  while (run.activeMs < due && run.status === 'playing') run = stepRun(run, 100, catalog).run;
  run = stepRun(run, 100, catalog).run;
  // A recruiter calls; the player takes the job.
  run = { ...run, job: { ...run.job, offer: { salary: 400, expiresAtMs: run.activeMs + 90_000 } } };
  return applyCommand(run, { type: 'selectProject', id: 'job' }, run.activeMs, catalog).run;
}

/** Current-format fixtures (schema 10), produced by the same real game paths. */
const BUILDERS: Record<string, () => string> = {
  'v10-fresh': () => saveWithProfile(createRun(1, 'fixture-fresh'), []),
  'v10-midgame': () => saveWithProfile(progressedRun(6, true), []),
  'v10-dead-cat': () => saveWithProfile(neglectedRun(), []),
  'v10-stray-cat': () => saveWithProfile(strayRun(), []),
  'v10-shipped': () => saveWithProfile(shippedRun(), []),
  'v10-demos': () => saveWithProfile(demoRun(), []),
  'v10-money': () => saveWithProfile(moneyRun(), []),
  'v10-ended': () => {
    const run = endedRun();
    return saveWithProfile(run, [
      { id: 'the-forgotten-project', runId: run.id, activeMs: run.activeMs, order: 1 },
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
const V3 = ['v3-fresh', 'v3-midgame', 'v3-dead-cat', 'v3-stray-cat', 'v3-ended'] as const;
const V4 = [
  'v4-fresh',
  'v4-midgame',
  'v4-dead-cat',
  'v4-stray-cat',
  'v4-shipped',
  'v4-ended',
] as const;
const V5 = [
  'v5-fresh',
  'v5-midgame',
  'v5-dead-cat',
  'v5-stray-cat',
  'v5-shipped',
  'v5-ended',
] as const;
const V6 = [
  'v6-fresh',
  'v6-midgame',
  'v6-dead-cat',
  'v6-stray-cat',
  'v6-shipped',
  'v6-ended',
] as const;
const V7 = [
  'v7-fresh',
  'v7-midgame',
  'v7-dead-cat',
  'v7-stray-cat',
  'v7-shipped',
  'v7-ended',
] as const;
const V8 = [
  'v8-fresh',
  'v8-midgame',
  'v8-dead-cat',
  'v8-stray-cat',
  'v8-shipped',
  'v8-demos',
  'v8-ended',
] as const;
const V9 = [
  'v9-fresh',
  'v9-midgame',
  'v9-dead-cat',
  'v9-stray-cat',
  'v9-shipped',
  'v9-demos',
  'v9-ended',
] as const;
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

  for (const name of [...V1, ...V2, ...V3]) {
    it(`${name} gets no releases and a release stream (3 → 4)`, () => {
      const save = loaded(file(name));
      expect(save.run.releases).toEqual([]);
      expect(save.run.rng.release).toBeGreaterThanOrEqual(0);
      expect(save.run.choices).not.toHaveProperty('ship-original');
    });
  }

  for (const name of [...V1, ...V2, ...V3, ...V4]) {
    it(`${name} gets a living plant (4 → 5)`, () => {
      expect(loaded(file(name)).run.plant).toMatchObject({ alive: true, water: 60 });
    });
  }

  for (const name of [...V1, ...V2, ...V3, ...V4, ...V5]) {
    it(`${name} starts without experience (5 → 6)`, () => {
      const save = loaded(file(name));
      expect(save.run.experience).toBe(0);
      expect(save.profile.experience).toBe(0);
    });
  }

  for (const name of [...V1, ...V2, ...V3, ...V4, ...V5, ...V6]) {
    it(`${name} has no token-review card any more (6 → 7)`, () => {
      expect(loaded(file(name)).run.upgradeLevels).not.toHaveProperty('token-review');
    });
  }

  for (const name of [...V1, ...V2, ...V3, ...V4, ...V5, ...V6, ...V7]) {
    it(`${name} gets no demos and a demo stream (7 → 8)`, () => {
      const save = loaded(file(name));
      expect(save.run.demos).toEqual([]);
      expect(save.run.rng.demo).toBeGreaterThanOrEqual(0);
      expect(save.run.rng.demo).not.toBe(save.run.rng.release);
    });
  }

  for (const name of V8) {
    it(`${name} keeps its demos, each the judge's choice, and no design yet (8 → 9)`, () => {
      const save = loaded(file(name));
      const raw = JSON.parse(file(name)) as { run: { demos: { seed: number }[] } };
      expect(save.run.demos.map((d) => d.seed)).toEqual(raw.run.demos.map((d) => d.seed));
      expect(save.run.demos.every((d) => d.pick === null)).toBe(true);
      expect(save.run.demoPick).toBeNull();
    });
  }

  for (const name of [...V1, ...V2, ...V3, ...V4, ...V5, ...V6, ...V7, ...V8, ...V9]) {
    it(`${name} builds its banked code into the release and starts on its own (9 → 10)`, () => {
      const save = loaded(file(name));
      const raw = JSON.parse(file(name)) as { run: { economy: { output?: number } } };
      expect(save.run.economy).not.toHaveProperty('output');
      expect(save.run.economy).not.toHaveProperty('revenue');
      expect(save.run.slots).toEqual([
        { target: 'release', by: 'player', sinceMs: save.run.activeMs },
      ]);
      const bank = raw.run.economy.output ?? 0;
      const release = save.run.projects.release;
      if (bank > 0 && name.startsWith('v9')) {
        expect(release?.code).toBe(Math.min(bank, release?.price ?? 0));
      }
      expect(save.run.frugal).toBe(1);
      expect(save.run.rent).toMatchObject({ movedOut: false, missedStreak: 0 });
      expect(save.run.job).toMatchObject({ offer: null, employed: null });
      expect(save.run.notices).toEqual([]);
      expect(save.run.rng.gigs).not.toBe(save.run.rng.rent);
    });
  }

  it('a migrated run past a market wall replays no market updates', () => {
    const save = loaded(file('v9-ended'));
    const eras = save.run.history.filter((h) => h.kind === 'market').length;
    expect(eras).toBeGreaterThan(0);
    expect(save.run.notices).toEqual([]);
  });

  it('money, rent, the landlord wheel and the job round-trip', () => {
    const save = loaded(fixture('v10-money'));
    expect(save.run.rent.movedOut).toBe(true);
    expect(save.run.rentWheels.length).toBeGreaterThan(0);
    expect(save.run.job.employed).toMatchObject({ salary: 400, paydays: 0, permanent: false });
    expect(save.run.slots[0]?.target).toBe('job');
  });

  it('coded and designed demos round-trip with their seeds, picks and History entries', () => {
    const save = loaded(fixture('v10-demos'));
    expect(save.run.demos.map((d) => [d.number, d.pick])).toEqual([
      [1, null],
      [2, 2],
    ]);
    expect(save.run.demoPick).toBe(3);
    expect(save.run.history.filter((h) => h.kind === 'demo')).toHaveLength(2);
  });

  it('a run that ended with the retired one-click ship keeps its legacy ending', () => {
    const save = loaded(file('v3-ended'));
    expect(save.run.status).toBe('ended');
    expect(save.run.ending?.id).toBe('three-users');
    expect(save.profile.endings.map((e) => e.id)).toEqual(['three-users']);
  });

  it('a shipped release round-trips with its outcome, comment and cat', () => {
    const save = loaded(fixture('v10-shipped'));
    expect(save.run.releases).toHaveLength(1);
    expect(save.run.releases[0]).toMatchObject({ window: 1, catAlive: true });
    expect(save.run.history.some((h) => h.kind === 'release')).toBe(true);
  });

  it('a stray cat stays gone and is not mistaken for a dead one', () => {
    const stray = loaded(fixture('v10-stray-cat'));
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
    expect(save.run.rng).toMatchObject(
      (JSON.parse(file('v1-midgame')) as { run: { rng: object } }).run.rng,
    );
  });

  it('mid-game keeps RNG streams, the pending reveal and care cooldowns', () => {
    const save = loaded(fixture('v10-midgame'));
    const original = JSON.parse(fixture('v10-midgame')) as { run: { rng: unknown } };
    expect(save.run.rng).toEqual(original.run.rng);
    expect(save.run.pendingUnlockIds.length).toBeGreaterThan(0);
    expect(save.run.cat.lastFedAtActiveMs).not.toBeNull();
  });

  it('a dead cat stays dead and an ended run stays ended', () => {
    const dead = loaded(fixture('v10-dead-cat'));
    expect(dead.run.cat.alive).toBe(false);
    expect(dead.run.history.some((h) => h.kind === 'cat' && h.id === 'cat-died')).toBe(true);
    const ended = loaded(fixture('v10-ended'));
    expect(ended.run.status).toBe('ended');
    expect(ended.run.ending?.id).toBe('the-forgotten-project');
    expect(ended.profile.endings.map((e) => e.id)).toEqual(['the-forgotten-project']);
  });

  it('a future schema, unknown IDs or out-of-range values are refused and never overwritten', () => {
    const base = JSON.parse(fixture('v10-midgame')) as Record<string, unknown> & {
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
