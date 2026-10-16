/**
 * Human reviews of exact pattern versions (sound architecture §9). Pure: no storage, no DOM.
 * A record's key is `id@revision#contentHash`; a decision for an older payload never carries
 * over to a changed one (it is reported as stale). Imports merge without silently overwriting a
 * different local decision: such pairs become explicit conflicts.
 */
import { LIMITS } from '../music/core/schema';
import { validateReview } from '../music/core/review';
import type { ReviewDocument } from '../music/data/patterns.generated';

export type ReviewStatus = ReviewDocument['status'];

export interface PatternVersion {
  readonly patternId: string;
  readonly revision: number;
  readonly contentHash: string;
}

export interface ReviewBook {
  readonly records: ReadonlyMap<string, ReviewDocument>;
  /** Unsaved feedback text per exact key (survives reloads; not part of an export). */
  readonly drafts: ReadonlyMap<string, string>;
}

export interface ReviewView {
  readonly status: ReviewStatus;
  readonly rating: number | null;
  readonly feedback: string;
  /** A decision exists for this id@revision but for a different payload. */
  readonly stale: boolean;
  readonly staleStatus: ReviewStatus | null;
}

export interface ReviewConflict {
  readonly key: string;
  readonly local: ReviewDocument;
  readonly incoming: ReviewDocument;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const REVIEW_ENVELOPE_KIND = 'vibe-coder-music-reviews';

export const exactKey = (v: PatternVersion) => `${v.patternId}@${v.revision}#${v.contentHash}`;
export const versionKey = (v: { patternId: string; revision: number }) =>
  `${v.patternId}@${v.revision}`;

export const emptyBook = (): ReviewBook => ({ records: new Map(), drafts: new Map() });

export function reviewFor(book: ReviewBook, version: PatternVersion): ReviewView {
  const record = book.records.get(exactKey(version));
  if (record) {
    return {
      status: record.status,
      rating: record.rating ?? null,
      feedback: record.feedback ?? '',
      stale: false,
      staleStatus: null,
    };
  }
  const older = [...book.records.values()].find(
    (r) =>
      r.patternId === version.patternId &&
      r.revision === version.revision &&
      r.contentHash !== version.contentHash,
  );
  return {
    status: 'unreviewed',
    rating: null,
    feedback: '',
    stale: older !== undefined,
    staleStatus: older?.status ?? null,
  };
}

export interface DecisionChange {
  readonly status?: ReviewStatus;
  readonly rating?: number | null;
  readonly feedback?: string;
}

/** Record a human decision for one exact version. `playable` = no hard validation errors. */
export function decide(
  book: ReviewBook,
  version: PatternVersion,
  change: DecisionChange,
  now: string,
  playable: boolean,
): Result<ReviewBook> {
  const key = exactKey(version);
  const current = book.records.get(key);
  const status = change.status ?? current?.status ?? 'unreviewed';
  if (status === 'approved' && !playable) {
    return { ok: false, error: 'A version with validation errors cannot be approved.' };
  }
  const rating = change.rating === undefined ? current?.rating : (change.rating ?? undefined);
  if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return { ok: false, error: 'Rating must be a whole number from 1 to 5.' };
  }
  const feedback = change.feedback ?? current?.feedback;
  if (feedback !== undefined && feedback.length > LIMITS.feedbackBytes) {
    return { ok: false, error: `Feedback is longer than ${LIMITS.feedbackBytes} characters.` };
  }
  const record: ReviewDocument = Object.freeze({
    schemaVersion: 1,
    patternId: version.patternId,
    revision: version.revision,
    contentHash: version.contentHash,
    status,
    ...(rating !== undefined ? { rating } : {}),
    ...(feedback ? { feedback } : {}),
    updatedAt: now,
  });
  const checked = validateReview(record);
  if (!checked.value) return { ok: false, error: checked.errors.map((e) => e.message).join('; ') };
  const records = new Map(book.records).set(key, record);
  const drafts = new Map(book.drafts);
  if (change.feedback !== undefined) drafts.delete(key);
  return { ok: true, value: { records, drafts } };
}

/** Exact `id@revision` keys whose approval matches the current payload hash. */
export function approvedKeys(
  book: ReviewBook,
  currentHashes: ReadonlyMap<string, string>,
): Set<string> {
  const keys = new Set<string>();
  for (const record of book.records.values()) {
    const key = versionKey(record);
    if (record.status === 'approved' && currentHashes.get(key) === record.contentHash) {
      keys.add(key);
    }
  }
  return keys;
}

export function encodeReviewEnvelope(book: ReviewBook): string {
  const records = [...book.records.values()].sort((a, b) => exactKey(a).localeCompare(exactKey(b)));
  return `${JSON.stringify({ schemaVersion: 1, kind: REVIEW_ENVELOPE_KIND, records }, null, 2)}\n`;
}

/** The one decoder for files, clipboard and CLI. Size is checked before parsing. */
export function decodeReviewEnvelope(text: string): Result<ReviewDocument[]> {
  if (new TextEncoder().encode(text).length > LIMITS.batchBytes) {
    return { ok: false, error: `Review file is too large (limit ${LIMITS.batchBytes} bytes).` };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: `Not JSON: ${String(error)}` };
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    (value as { schemaVersion?: unknown }).schemaVersion !== 1 ||
    (value as { kind?: unknown }).kind !== REVIEW_ENVELOPE_KIND ||
    !Array.isArray((value as { records?: unknown }).records)
  ) {
    return { ok: false, error: `Not a ${REVIEW_ENVELOPE_KIND} v1 document.` };
  }
  const raw = (value as { records: unknown[] }).records;
  if (raw.length > LIMITS.reviewsPerBatch) {
    return {
      ok: false,
      error: `A review file may hold at most ${LIMITS.reviewsPerBatch} records (${raw.length}).`,
    };
  }
  const records: ReviewDocument[] = [];
  const problems: string[] = [];
  (value as { records: unknown[] }).records.forEach((raw, i) => {
    const checked = validateReview(raw);
    if (checked.value) records.push(Object.freeze({ ...checked.value }));
    else
      problems.push(
        `records/${i}: ${checked.errors.map((e) => `${e.path} ${e.message}`).join('; ')}`,
      );
  });
  if (problems.length > 0) return { ok: false, error: problems.join('\n') };
  return { ok: true, value: records };
}

const sameDecision = (a: ReviewDocument, b: ReviewDocument) =>
  a.status === b.status && a.rating === b.rating && (a.feedback ?? '') === (b.feedback ?? '');

export interface MergeResult {
  readonly book: ReviewBook;
  readonly added: number;
  readonly identical: number;
  readonly conflicts: readonly ReviewConflict[];
}

export function mergeImport(book: ReviewBook, incoming: readonly ReviewDocument[]): MergeResult {
  const records = new Map(book.records);
  const conflicts: ReviewConflict[] = [];
  let added = 0;
  let identical = 0;
  for (const record of incoming) {
    const key = exactKey(record);
    const local = records.get(key);
    if (!local) {
      records.set(key, record);
      added += 1;
    } else if (sameDecision(local, record)) {
      identical += 1;
    } else {
      conflicts.push({ key, local, incoming: record });
    }
  }
  return { book: { records, drafts: book.drafts }, added, identical, conflicts };
}

export function resolveConflict(
  book: ReviewBook,
  conflict: ReviewConflict,
  choice: 'keep-local' | 'use-import',
): ReviewBook {
  if (choice === 'keep-local') return book;
  return {
    records: new Map(book.records).set(conflict.key, conflict.incoming),
    drafts: book.drafts,
  };
}
