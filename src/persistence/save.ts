import { TECHNOLOGY_IDS, UPGRADE_IDS, isUpgradeId, type UpgradeId } from '../game/ids';
import {
  CAT_HISTORY_IDS,
  type CatState,
  type HistoryEntry,
  type LogEntry,
  type RunState,
} from '../game/types';
import {
  DecodeError,
  bool,
  fail,
  list,
  nullableNum,
  num,
  oneOf,
  record,
  str,
  uniqueList,
} from './decode';
import { CURRENT_SCHEMA_VERSION, migrate } from './migrations';

export { CURRENT_SCHEMA_VERSION };
export const SAVE_KEY = 'vibe-coder.save';
export const CONTENT_VERSION = 1;
const CARE_NOTES = ['nom', 'notHungry', 'tooMuch', 'spherical', 'purr'] as const;

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Survives a new run. */
export interface ProfileState {
  theme: Theme;
}

/** One envelope holds profile and run so a restart or ending never saves half a change. */
export interface SaveData {
  schemaVersion: number;
  contentVersion: number;
  revision: number;
  profile: ProfileState;
  run: RunState;
}

export type LoadResult =
  | { status: 'empty' }
  | { status: 'loaded'; save: SaveData }
  | { status: 'corrupt'; reason: string; raw: string }
  | { status: 'unsupported'; reason: string; raw: string };

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type WriteResult = { ok: true } | { ok: false; error: string };

export function createProfile(): ProfileState {
  return { theme: 'light' };
}

export function encodeSave(save: SaveData): string {
  return JSON.stringify({
    schemaVersion: save.schemaVersion,
    contentVersion: save.contentVersion,
    revision: save.revision,
    profile: save.profile,
    run: save.run,
  });
}

const percent = { min: 0, max: 100 };
const nonNegative = { min: 0 };

function decodeLastCare(value: unknown, path: string): CatState['lastCare'] {
  if (value === null) return null;
  const raw = record(value, path);
  return {
    note: oneOf(raw.note, `${path}.note`, CARE_NOTES),
    atActiveMs: num(raw.atActiveMs, `${path}.atActiveMs`, nonNegative),
  };
}

function decodeCat(value: unknown, path: string): CatState {
  const raw = record(value, path);
  const cat: CatState = {
    health: num(raw.health, `${path}.health`, percent),
    mood: num(raw.mood, `${path}.mood`, percent),
    fullness: num(raw.fullness, `${path}.fullness`, percent),
    overfeeding: num(raw.overfeeding, `${path}.overfeeding`, nonNegative),
    alive: bool(raw.alive, `${path}.alive`),
    diedAtActiveMs: nullableNum(raw.diedAtActiveMs, `${path}.diedAtActiveMs`, nonNegative),
    needsElapsedMs: num(raw.needsElapsedMs, `${path}.needsElapsedMs`, { min: 0, max: 60_000 }),
    pendingActions: num(raw.pendingActions, `${path}.pendingActions`, { min: 0, integer: true }),
    lastFedAtActiveMs: nullableNum(raw.lastFedAtActiveMs, `${path}.lastFedAtActiveMs`, nonNegative),
    lastPetAtActiveMs: nullableNum(raw.lastPetAtActiveMs, `${path}.lastPetAtActiveMs`, nonNegative),
    lastCare: decodeLastCare(raw.lastCare, `${path}.lastCare`),
  };
  if (!cat.alive && cat.diedAtActiveMs === null) fail(path, 'dead cat without a death time');
  if (cat.alive && cat.diedAtActiveMs !== null) fail(path, 'living cat with a death time');
  if (!cat.alive && cat.health !== 0) fail(path, 'dead cat with nonzero health');
  return cat;
}

function decodeHistoryEntry(value: unknown, path: string): HistoryEntry {
  const raw = record(value, path);
  const activeMs = num(raw.activeMs, `${path}.activeMs`, nonNegative);
  const kind = oneOf(raw.kind, `${path}.kind`, ['technology', 'cat', 'event'] as const);
  switch (kind) {
    case 'cat':
      return { kind, id: oneOf(raw.id, `${path}.id`, CAT_HISTORY_IDS), activeMs };
    case 'technology':
      return { kind, id: oneOf(raw.id, `${path}.id`, TECHNOLOGY_IDS), activeMs };
    case 'event':
      return { kind, textId: str(raw.textId, `${path}.textId`), activeMs };
  }
}

function decodeLogEntry(value: unknown, path: string): LogEntry {
  const raw = record(value, path);
  return {
    text: str(raw.text, `${path}.text`, 500),
    activeMs: num(raw.activeMs, `${path}.activeMs`, nonNegative),
  };
}

function decodeUpgradeLevels(value: unknown, path: string): Partial<Record<UpgradeId, number>> {
  const raw = record(value, path);
  const levels: Partial<Record<UpgradeId, number>> = {};
  for (const [key, level] of Object.entries(raw)) {
    if (!isUpgradeId(key)) fail(`${path}.${key}`, `unknown upgrade (known: ${UPGRADE_IDS.length})`);
    levels[key] = num(level, `${path}.${key}`, { min: 0, max: 1000, integer: true });
  }
  return levels;
}

export function decodeRun(value: unknown, path = 'run'): RunState {
  const raw = record(value, path);
  const rng = record(raw.rng, `${path}.rng`);
  const economy = record(raw.economy, `${path}.economy`);
  const stats = record(raw.stats, `${path}.stats`);
  const uint32 = { min: 0, max: 0xffffffff, integer: true };
  const run: RunState = {
    id: str(raw.id, `${path}.id`),
    status: oneOf(raw.status, `${path}.status`, ['playing', 'ended'] as const),
    activeMs: num(raw.activeMs, `${path}.activeMs`, nonNegative),
    rng: {
      economy: num(rng.economy, `${path}.rng.economy`, uint32),
      cat: num(rng.cat, `${path}.rng.cat`, uint32),
      narrative: num(rng.narrative, `${path}.rng.narrative`, uint32),
    },
    visualSeed: num(raw.visualSeed, `${path}.visualSeed`, uint32),
    economy: {
      output: num(economy.output, `${path}.economy.output`, nonNegative),
      pendingManualWork: num(
        economy.pendingManualWork,
        `${path}.economy.pendingManualWork`,
        nonNegative,
      ),
    },
    stats: {
      lifetimeOutput: num(stats.lifetimeOutput, `${path}.stats.lifetimeOutput`, nonNegative),
    },
    cat: decodeCat(raw.cat, `${path}.cat`),
    history: list(raw.history, `${path}.history`, decodeHistoryEntry, 2000),
    log: list(raw.log, `${path}.log`, decodeLogEntry, 200),
    unlockedTechnologyIds: uniqueList(
      raw.unlockedTechnologyIds,
      `${path}.unlockedTechnologyIds`,
      TECHNOLOGY_IDS,
    ),
    upgradeLevels: decodeUpgradeLevels(raw.upgradeLevels, `${path}.upgradeLevels`),
    pendingUnlockIds: uniqueList(raw.pendingUnlockIds, `${path}.pendingUnlockIds`, TECHNOLOGY_IDS),
    ending: raw.ending === null ? null : fail(`${path}.ending`, 'expected null'),
  };
  if (run.pendingUnlockIds.some((id) => !run.unlockedTechnologyIds.includes(id))) {
    fail(`${path}.pendingUnlockIds`, 'pending unlock that is not unlocked');
  }
  return run;
}

function decodeProfile(value: unknown, path = 'profile'): ProfileState {
  const raw = record(value, path);
  return { theme: oneOf(raw.theme, `${path}.theme`, THEMES) };
}

/** Validate untrusted saved data. Never repairs, never falls back to an older or new run. */
export function decodeSave(input: unknown, rawText = ''): LoadResult {
  const raw = rawText || safeStringify(input);
  try {
    const envelope = record(input, 'save');
    const migrated = migrate(envelope);
    if (!migrated.ok) {
      return migrated.unsupported
        ? { status: 'unsupported', reason: migrated.reason, raw }
        : { status: 'corrupt', reason: migrated.reason, raw };
    }
    const value = migrated.value;
    return {
      status: 'loaded',
      save: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        contentVersion: num(value.contentVersion, 'save.contentVersion', { min: 1, integer: true }),
        revision: num(value.revision, 'save.revision', { min: 0, integer: true }),
        profile: decodeProfile(value.profile),
        run: decodeRun(value.run),
      },
    };
  } catch (error) {
    if (error instanceof DecodeError) return { status: 'corrupt', reason: error.message, raw };
    throw error;
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export interface SaveAdapter {
  load(): LoadResult;
  write(save: SaveData): WriteResult;
}

/** LocalStorage-backed save slot. `setItem` atomically replaces the single envelope. */
export function createSaveAdapter(storage: StorageLike, key = SAVE_KEY): SaveAdapter {
  return {
    load() {
      let text: string | null;
      try {
        text = storage.getItem(key);
      } catch (error) {
        return { status: 'corrupt', reason: `storage unreadable: ${String(error)}`, raw: '' };
      }
      if (text === null) return { status: 'empty' };
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { status: 'corrupt', reason: 'invalid JSON', raw: text };
      }
      return decodeSave(parsed, text);
    },
    write(save) {
      try {
        storage.setItem(key, encodeSave(save));
        return { ok: true };
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    },
  };
}
