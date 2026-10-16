import {
  CHOICE_IDS,
  ENDING_IDS,
  RELEASE_OUTCOME_IDS,
  MAX_RELEASES,
  TECHNOLOGY_IDS,
  type ReleaseWindow,
  UPGRADE_IDS,
  isUpgradeId,
  type UpgradeId,
} from '../game/ids';
import {
  CAT_HISTORY_IDS,
  type CatPlayState,
  type CatState,
  type DiscoveredEnding,
  type EconomyState,
  type RunStats,
  type HistoryEntry,
  type LogEntry,
  type ReleaseRecord,
  type RunState,
} from '../game/types';

const RELEASE_RESULTS = [...RELEASE_OUTCOME_IDS, 'jackpot'] as const;

function releaseWindow(value: unknown, path: string): ReleaseWindow {
  const window = num(value, path, { min: 1, max: MAX_RELEASES, integer: true });
  return window;
}

function decodePlant(value: unknown, path: string): RunState['plant'] {
  const raw = record(value, path);
  const plant: RunState['plant'] = {
    water: num(raw.water, `${path}.water`, { min: 0, max: 1000 }),
    alive: bool(raw.alive, `${path}.alive`),
    diedAtActiveMs: nullableNum(raw.diedAtActiveMs, `${path}.diedAtActiveMs`, nonNegative),
    cause:
      raw.cause === null ? null : oneOf(raw.cause, `${path}.cause`, ['drowned', 'dried'] as const),
    warned: bool(raw.warned, `${path}.warned`),
  };
  if (plant.alive !== (plant.diedAtActiveMs === null) || plant.alive !== (plant.cause === null)) {
    fail(path, 'a dead plant needs a time and a cause, a living one neither');
  }
  return plant;
}

function decodeRelease(value: unknown, path: string): ReleaseRecord {
  const raw = record(value, path);
  const outcome = oneOf(raw.outcome, `${path}.outcome`, RELEASE_RESULTS);
  const release: ReleaseRecord = {
    window: releaseWindow(raw.window, `${path}.window`),
    outcome,
    commentId: raw.commentId === null ? null : str(raw.commentId, `${path}.commentId`, 40),
    catAlive: bool(raw.catAlive, `${path}.catAlive`),
    activeMs: num(raw.activeMs, `${path}.activeMs`, nonNegative),
  };
  if ((outcome === 'jackpot') !== (release.commentId === null))
    fail(path, 'a jackpot has no comment and every other release has one');
  return release;
}
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
const CARE_NOTES = [
  'nom',
  'notHungry',
  'tooMuch',
  'spherical',
  'purr',
  'playWin',
  'playLose',
] as const;
const OUTCOMES = ['hit', 'near', 'miss'] as const;

/** The player's preference; `auto` (the default) follows the system's light/dark setting. */
export const THEMES = ['auto', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Survives a new run. */
export interface ProfileState {
  theme: Theme;
  endings: DiscoveredEnding[];
  /** Code yield earned by "lesson learned" endings; every new run starts with it. */
  experience: number;
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
  return { theme: 'auto', endings: [], experience: 0 };
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

/** Every economy and statistics field is a finite, nonnegative number. */
const ECONOMY_FIELDS = [
  'output',
  'pendingManualWork',
  'tokens',
  'tasks',
  'actionCharges',
  'debt',
  'delegation',
  'optimization',
  'revenue',
  'revenuePerSecond',
  'costPerSecond',
  'autoRefills',
  'tokenReviewBonus',
  'autoReviewMs',
  'tokenDemandPerSecond',
] as const satisfies readonly (keyof EconomyState)[];
const STATS_FIELDS = [
  'lifetimeOutput',
  'feeds',
  'pets',
  'playHits',
  'manualActions',
  'lowDebtMs',
  'positiveMarginMs',
  'negativeMarginMs',
  'refillDisasters',
] as const satisfies readonly (keyof RunStats)[];

// Compile-time proof that the field lists cover the whole state shape.
type Missing<T, K extends readonly (keyof T)[]> = Exclude<keyof T, K[number]>;
const economyCovered: [Missing<EconomyState, typeof ECONOMY_FIELDS>] extends [never]
  ? true
  : never = true;
const statsCovered: [Missing<RunStats, typeof STATS_FIELDS>] extends [never] ? true : never = true;
void economyCovered;
void statsCovered;

function decodeNumbers<K extends string>(
  raw: Record<string, unknown>,
  fields: readonly K[],
  path: string,
): Record<K, number> {
  const result = {} as Record<K, number>;
  for (const field of fields) {
    // The bank may be in the red (a credit line), never anything else.
    const range = field === 'revenue' ? { min: -1e18 } : nonNegative;
    result[field] = num(raw[field], `${path}.${field}`, range);
  }
  return result;
}

function decodeNarrative(value: unknown, path: string): RunState['narrative'] {
  const raw = record(value, path);
  const lastAt: Record<string, number> = {};
  for (const [id, at] of Object.entries(record(raw.lastAt, `${path}.lastAt`))) {
    lastAt[str(id, `${path}.lastAt`, 80)] = num(at, `${path}.lastAt.${id}`, nonNegative);
  }
  return { fired: list(raw.fired, `${path}.fired`, (e, p) => str(e, p, 80), 500), lastAt };
}

function decodeChoices(value: unknown, path: string): RunState['choices'] {
  const raw = record(value, path);
  const choices: RunState['choices'] = {};
  for (const [id, entry] of Object.entries(raw)) {
    const choice = oneOf(id, `${path}`, CHOICE_IDS);
    const fields = record(entry, `${path}.${id}`);
    choices[choice] = {
      atActiveMs: num(fields.atActiveMs, `${path}.${id}.atActiveMs`, nonNegative),
      manualActions: num(fields.manualActions, `${path}.${id}.manualActions`, nonNegative),
      overhead: num(fields.overhead, `${path}.${id}.overhead`, nonNegative),
    };
  }
  return choices;
}

function decodeEnding(value: unknown, path: string): NonNullable<RunState['ending']> {
  const raw = record(value, path);
  return {
    id: oneOf(raw.id, `${path}.id`, ENDING_IDS),
    catAlive: bool(raw.catAlive, `${path}.catAlive`),
    catLeft: bool(raw.catLeft, `${path}.catLeft`),
    activeMs: num(raw.activeMs, `${path}.activeMs`, nonNegative),
  };
}

function decodeAttention(value: unknown, path: string): RunState['attention'] {
  const raw = record(value, path);
  return {
    nextAtMs: nullableNum(raw.nextAtMs, `${path}.nextAtMs`, nonNegative),
    visibleUntilMs: nullableNum(raw.visibleUntilMs, `${path}.visibleUntilMs`, nonNegative),
    level:
      raw.level === null ? null : oneOf(raw.level, `${path}.level`, ['small', 'large'] as const),
    count: num(raw.count, `${path}.count`, { min: 0, integer: true }),
  };
}

function decodeCatPlay(value: unknown, path: string): CatPlayState | null {
  if (value === null) return null;
  const raw = record(value, path);
  const target = record(raw.target, `${path}.target`);
  const width = num(target.width, `${path}.target.width`, { min: 0.01, max: 1 });
  const play: CatPlayState = {
    attemptNumber: num(raw.attemptNumber, `${path}.attemptNumber`, {
      min: 1,
      max: 10,
      integer: true,
    }),
    attemptId: num(raw.attemptId, `${path}.attemptId`, { min: 1, integer: true }),
    attemptStartMs: num(raw.attemptStartMs, `${path}.attemptStartMs`, nonNegative),
    movementOriginMs: num(raw.movementOriginMs, `${path}.movementOriginMs`, nonNegative),
    movementEndMs: num(raw.movementEndMs, `${path}.movementEndMs`, nonNegative),
    attemptEndMs: num(raw.attemptEndMs, `${path}.attemptEndMs`, nonNegative),
    cueUntilMs: nullableNum(raw.cueUntilMs, `${path}.cueUntilMs`, nonNegative),
    target: {
      start: num(target.start, `${path}.target.start`, { min: 0, max: 1 - width + 1e-9 }),
      width,
    },
    speed: num(raw.speed, `${path}.speed`, { min: 0.01, max: 5 }),
    outcome: raw.outcome === null ? null : decodeOutcome(raw.outcome, `${path}.outcome`),
    previous: list(raw.previous, `${path}.previous`, (e, p) => oneOf(e, p, OUTCOMES), 10),
  };
  const ordered =
    play.attemptStartMs <= play.movementOriginMs &&
    play.movementOriginMs <= play.movementEndMs &&
    play.movementEndMs <= play.attemptEndMs;
  if (!ordered) fail(path, 'inconsistent attempt timeline');
  return play;
}

function decodeOutcome(value: unknown, path: string): NonNullable<CatPlayState['outcome']> {
  const raw = record(value, path);
  return {
    kind: oneOf(raw.kind, `${path}.kind`, OUTCOMES),
    moodGain: num(raw.moodGain, `${path}.moodGain`, { min: 0, max: 100 }),
    atMs: num(raw.atMs, `${path}.atMs`, nonNegative),
    position: num(raw.position, `${path}.position`, { min: 0, max: 1 }),
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
    leftAtActiveMs: nullableNum(raw.leftAtActiveMs, `${path}.leftAtActiveMs`, nonNegative),
    ignoredMs: num(raw.ignoredMs, `${path}.ignoredMs`, nonNegative),
    needsElapsedMs: num(raw.needsElapsedMs, `${path}.needsElapsedMs`, { min: 0, max: 60_000 }),
    pendingActions: num(raw.pendingActions, `${path}.pendingActions`, { min: 0, integer: true }),
    lastFedAtActiveMs: nullableNum(raw.lastFedAtActiveMs, `${path}.lastFedAtActiveMs`, nonNegative),
    lastPetAtActiveMs: nullableNum(raw.lastPetAtActiveMs, `${path}.lastPetAtActiveMs`, nonNegative),
    lastCare: decodeLastCare(raw.lastCare, `${path}.lastCare`),
  };
  const died = cat.diedAtActiveMs !== null;
  const left = cat.leftAtActiveMs !== null;
  if (!cat.alive && died === left) fail(path, 'gone cat needs exactly one of death or leaving');
  if (cat.alive && died) fail(path, 'living cat with a death time');
  if (cat.alive && left) fail(path, 'present cat with a leaving time');
  if (died && cat.health !== 0) fail(path, 'dead cat with nonzero health');
  return cat;
}

function decodeHistoryEntry(value: unknown, path: string): HistoryEntry {
  const raw = record(value, path);
  const activeMs = num(raw.activeMs, `${path}.activeMs`, nonNegative);
  const kind = oneOf(raw.kind, `${path}.kind`, [
    'technology',
    'cat',
    'event',
    'achievement',
    'ending',
    'release',
  ] as const);
  switch (kind) {
    case 'cat':
      return { kind, id: oneOf(raw.id, `${path}.id`, CAT_HISTORY_IDS), activeMs };
    case 'technology':
      return { kind, id: oneOf(raw.id, `${path}.id`, TECHNOLOGY_IDS), activeMs };
    case 'event':
      return { kind, textId: str(raw.textId, `${path}.textId`), activeMs };
    case 'achievement':
      return { kind, id: str(raw.id, `${path}.id`, 80), activeMs };
    case 'ending':
      return { kind, id: oneOf(raw.id, `${path}.id`, ENDING_IDS), activeMs };
    case 'release':
      return {
        kind,
        window: releaseWindow(raw.window, `${path}.window`),
        outcome: oneOf(raw.outcome, `${path}.outcome`, RELEASE_RESULTS),
        activeMs,
      };
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
      release: num(rng.release, `${path}.rng.release`, uint32),
    },
    visualSeed: num(raw.visualSeed, `${path}.visualSeed`, uint32),
    economy: decodeNumbers(economy, ECONOMY_FIELDS, `${path}.economy`),
    stats: decodeNumbers(stats, STATS_FIELDS, `${path}.stats`),
    cat: decodeCat(raw.cat, `${path}.cat`),
    history: list(raw.history, `${path}.history`, decodeHistoryEntry, 2000),
    log: list(raw.log, `${path}.log`, decodeLogEntry, 200),
    unlockedTechnologyIds: uniqueList(
      raw.unlockedTechnologyIds,
      `${path}.unlockedTechnologyIds`,
      TECHNOLOGY_IDS,
    ),
    upgradeLevels: decodeUpgradeLevels(raw.upgradeLevels, `${path}.upgradeLevels`),
    achievementIds: list(
      raw.achievementIds,
      `${path}.achievementIds`,
      (e, p) => str(e, p, 80),
      200,
    ),
    pendingUnlockIds: uniqueList(raw.pendingUnlockIds, `${path}.pendingUnlockIds`, TECHNOLOGY_IDS),
    catPlay: decodeCatPlay(raw.catPlay, `${path}.catPlay`),
    narrative: decodeNarrative(raw.narrative, `${path}.narrative`),
    attention: decodeAttention(raw.attention, `${path}.attention`),
    catPlaySeq: num(raw.catPlaySeq, `${path}.catPlaySeq`, { min: 0, integer: true }),
    choices: decodeChoices(raw.choices, `${path}.choices`),
    releases: list(raw.releases, `${path}.releases`, decodeRelease, MAX_RELEASES),
    plant: decodePlant(raw.plant, `${path}.plant`),
    experience: num(raw.experience, `${path}.experience`, { min: 0, max: 100 }),
    ending: raw.ending === null ? null : decodeEnding(raw.ending, `${path}.ending`),
  };
  if ((run.status === 'ended') !== (run.ending !== null))
    fail(`${path}.ending`, 'status and ending disagree');
  if (run.catPlay && !run.cat.alive) fail(`${path}.catPlay`, 'play session with a dead cat');
  if (run.catPlay && run.catPlay.attemptId > run.catPlaySeq) {
    fail(`${path}.catPlay`, 'attempt ID ahead of sequence');
  }
  if (new Set(run.releases.map((r) => r.window)).size !== run.releases.length) {
    fail(`${path}.releases`, 'two releases in one window');
  }
  if (run.pendingUnlockIds.some((id) => !run.unlockedTechnologyIds.includes(id))) {
    fail(`${path}.pendingUnlockIds`, 'pending unlock that is not unlocked');
  }
  return run;
}

function decodeProfile(value: unknown, path = 'profile'): ProfileState {
  const raw = record(value, path);
  const endings = list(
    raw.endings,
    `${path}.endings`,
    (entry, p) => {
      const e = record(entry, p);
      return {
        id: oneOf(e.id, `${p}.id`, ENDING_IDS),
        runId: str(e.runId, `${p}.runId`),
        activeMs: num(e.activeMs, `${p}.activeMs`, nonNegative),
        order: num(e.order, `${p}.order`, { min: 1, integer: true }),
      };
    },
    100,
  );
  if (new Set(endings.map((e) => e.id)).size !== endings.length)
    fail(`${path}.endings`, 'duplicate ending');
  return {
    theme: oneOf(raw.theme, `${path}.theme`, THEMES),
    endings,
    // Tolerant: a profile recovered from an older, unreadable save has none yet.
    experience:
      raw.experience === undefined
        ? 0
        : num(raw.experience, `${path}.experience`, { min: 0, max: 100 }),
  };
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

/**
 * From an unreadable save, recover only the profile (theme and discovered endings) — and only
 * when that part validates on its own with the same strict decoder. Never digs facts out of a
 * broken object by assertion; anything doubtful yields null.
 */
export function recoverProfile(rawText: string): ProfileState | null {
  try {
    const envelope = record(JSON.parse(rawText) as unknown, 'save');
    // Only the profile is read, so any version this game can migrate is acceptable.
    const version = envelope.schemaVersion;
    if (typeof version !== 'number' || version < 1 || version > CURRENT_SCHEMA_VERSION) return null;
    return decodeProfile(envelope.profile);
  } catch {
    return null;
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
