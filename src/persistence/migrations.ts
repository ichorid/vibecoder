/**
 * Explicit save migrations, one per released format change. Each step takes the previous
 * envelope shape and returns the next; fixtures for every source version live in
 * tests/fixtures/saves/ and are never edited.
 *
 * - 1 → 2: tokens are bought with code instead of the "+6 tokens/s" card. New economy fields
 *   (auto-refill count, auto-review bonus and timer) and the disaster count start at zero; each
 *   old card level becomes a one-time grant of `TOKENS_PER_OLD_SUPPLY_LEVEL` tokens (≈ 5 minutes
 *   of the supply it used to give), and the level itself is dropped.
 * - 2 → 3: a neglected cat can leave as a stray. Cats get `leftAtActiveMs: null` and
 *   `ignoredMs: 0` (the ignored streak starts counting after loading); a stored ending gets
 *   `catLeft: false`, since no earlier cat could leave.
 * - 3 → 4: Ship It. Runs get `releases: []` and a release RNG stream derived from the run ID
 *   (old saves have no seed); the retired `ship-original` choice is dropped from `choices` (a
 *   run that took it has already ended with the legacy `three-users` ending, which stays).
 * - 4 → 5: the corner plant. Runs get a fresh, living plant (`water` 60).
 * - 5 → 6: experience. Profile and run get `experience: 0` (no ending gave any before).
 * - 6 → 7: the "Review your token spending" card is gone (economy redesign E1); its level is
 *   dropped (its few percent of token rate go with it).
 * - 7 → 8: Code a demo. Runs get `demos: []` and a demo RNG stream derived from the run ID.
 * - 8 → 9: designing demos. Each demo gets `pick: null` (the judge chose it) and the run
 *   `demoPick: null` (no design for the next one yet).
 */
import { deriveSeed } from '../game/random';

export const CURRENT_SCHEMA_VERSION = 9;

/** 6 tokens/s × 300 s: what one old supply level gave over five minutes. */
export const TOKENS_PER_OLD_SUPPLY_LEVEL = 1800;

export type MigrationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; unsupported: boolean; reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function v1ToV2(envelope: Record<string, unknown>): MigrationResult {
  const run = envelope.run;
  if (!isRecord(run) || !isRecord(run.economy) || !isRecord(run.stats)) {
    return { ok: false, unsupported: false, reason: 'v1 save without run economy/stats' };
  }
  const levels = isRecord(run.upgradeLevels) ? { ...run.upgradeLevels } : {};
  const supply = levels['token-supply'];
  const oldLevels = typeof supply === 'number' && Number.isFinite(supply) ? supply : 0;
  delete levels['token-supply'];
  const tokens = typeof run.economy.tokens === 'number' ? run.economy.tokens : 0;
  return {
    ok: true,
    value: {
      ...envelope,
      schemaVersion: 2,
      run: {
        ...run,
        upgradeLevels: levels,
        economy: {
          ...run.economy,
          tokens: tokens + oldLevels * TOKENS_PER_OLD_SUPPLY_LEVEL,
          autoRefills: 0,
          tokenReviewBonus: 0,
          autoReviewMs: 0,
          tokenDemandPerSecond: 0,
        },
        stats: { ...run.stats, refillDisasters: 0 },
      },
    },
  };
}

function v2ToV3(envelope: Record<string, unknown>): MigrationResult {
  const run = envelope.run;
  if (!isRecord(run) || !isRecord(run.cat)) {
    return { ok: false, unsupported: false, reason: 'v2 save without a run cat' };
  }
  return {
    ok: true,
    value: {
      ...envelope,
      schemaVersion: 3,
      run: {
        ...run,
        cat: { ...run.cat, leftAtActiveMs: null, ignoredMs: 0 },
        ending: isRecord(run.ending) ? { ...run.ending, catLeft: false } : run.ending,
      },
    },
  };
}

function v3ToV4(envelope: Record<string, unknown>): MigrationResult {
  const run = envelope.run;
  if (!isRecord(run) || !isRecord(run.rng) || typeof run.id !== 'string') {
    return { ok: false, unsupported: false, reason: 'v3 save without a run id/rng' };
  }
  const choices = isRecord(run.choices) ? { ...run.choices } : run.choices;
  if (isRecord(choices)) delete choices['ship-original'];
  return {
    ok: true,
    value: {
      ...envelope,
      schemaVersion: 4,
      run: {
        ...run,
        rng: { ...run.rng, release: deriveSeed(deriveSeed(0, run.id), 'release') },
        choices,
        releases: [],
      },
    },
  };
}

function v4ToV5(envelope: Record<string, unknown>): MigrationResult {
  const run = envelope.run;
  if (!isRecord(run)) return { ok: false, unsupported: false, reason: 'v4 save without a run' };
  return {
    ok: true,
    value: {
      ...envelope,
      schemaVersion: 5,
      run: {
        ...run,
        plant: { water: 60, alive: true, diedAtActiveMs: null, cause: null, warned: false },
      },
    },
  };
}

function v5ToV6(envelope: Record<string, unknown>): MigrationResult {
  const run = envelope.run;
  const profile = envelope.profile;
  if (!isRecord(run)) return { ok: false, unsupported: false, reason: 'v5 save without a run' };
  return {
    ok: true,
    value: {
      ...envelope,
      schemaVersion: 6,
      profile: isRecord(profile) ? { ...profile, experience: 0 } : profile,
      run: { ...run, experience: 0 },
    },
  };
}

function v6ToV7(envelope: Record<string, unknown>): MigrationResult {
  const run = envelope.run;
  if (!isRecord(run)) return { ok: false, unsupported: false, reason: 'v6 save without a run' };
  const levels = isRecord(run.upgradeLevels) ? { ...run.upgradeLevels } : {};
  delete levels['token-review'];
  return {
    ok: true,
    value: { ...envelope, schemaVersion: 7, run: { ...run, upgradeLevels: levels } },
  };
}

function v7ToV8(envelope: Record<string, unknown>): MigrationResult {
  const run = envelope.run;
  if (!isRecord(run) || !isRecord(run.rng) || typeof run.id !== 'string') {
    return { ok: false, unsupported: false, reason: 'v7 save without a run' };
  }
  return {
    ok: true,
    value: {
      ...envelope,
      schemaVersion: 8,
      run: {
        ...run,
        rng: { ...run.rng, demo: deriveSeed(deriveSeed(0, run.id), 'demo') },
        demos: [],
      },
    },
  };
}

function v8ToV9(envelope: Record<string, unknown>): MigrationResult {
  const run = envelope.run;
  if (!isRecord(run) || !Array.isArray(run.demos)) {
    return { ok: false, unsupported: false, reason: 'v8 save without demos' };
  }
  const demos = run.demos.map((d: unknown) => (isRecord(d) ? { ...d, pick: null } : d));
  return {
    ok: true,
    value: { ...envelope, schemaVersion: 9, run: { ...run, demos, demoPick: null } },
  };
}

const STEPS: Record<number, (envelope: Record<string, unknown>) => MigrationResult> = {
  1: v1ToV2,
  2: v2ToV3,
  3: v3ToV4,
  4: v4ToV5,
  5: v5ToV6,
  6: v6ToV7,
  7: v7ToV8,
  8: v8ToV9,
};

export function migrate(envelope: Record<string, unknown>): MigrationResult {
  const version = envelope.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, unsupported: false, reason: 'invalid schema version' };
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      unsupported: true,
      reason: `save schema ${version} is newer than this game`,
    };
  }
  let current: Record<string, unknown> = envelope;
  for (let v = version; v < CURRENT_SCHEMA_VERSION; v += 1) {
    const step = STEPS[v];
    if (!step) return { ok: false, unsupported: false, reason: `no migration from schema ${v}` };
    const result = step(current);
    if (!result.ok) return result;
    current = result.value;
  }
  return { ok: true, value: current };
}
