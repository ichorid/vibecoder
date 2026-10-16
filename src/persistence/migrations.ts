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
 */
import { deriveSeed } from '../game/random';

export const CURRENT_SCHEMA_VERSION = 4;

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

const STEPS: Record<number, (envelope: Record<string, unknown>) => MigrationResult> = {
  1: v1ToV2,
  2: v2ToV3,
  3: v3ToV4,
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
