/**
 * Browser persistence for Lab reviews: its own versioned key, separate from the game save and
 * the audio preferences. Unreadable data is reported and never overwritten until the reviewer
 * explicitly resets it; a full quota keeps the in-memory decision and says so.
 */
import { decodeReviewEnvelope, emptyBook, exactKey, type ReviewBook } from './reviews';

export const REVIEWS_KEY = 'vibecoder.music-reviews.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LoadedReviews {
  readonly book: ReviewBook;
  /** Non-null when stored data could not be read; saving is refused until `reset()`. */
  readonly error: string | null;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export interface ReviewStore {
  load(): LoadedReviews;
  save(book: ReviewBook): SaveResult;
  /** Explicitly discard unreadable stored reviews (the reviewer's decision). */
  reset(): void;
}

interface StoredReviews {
  schemaVersion: 1;
  kind: string;
  records: unknown[];
  drafts: Record<string, string>;
}

function isQuota(error: unknown): boolean {
  return error instanceof DOMException && /quota/i.test(`${error.name} ${error.message}`);
}

export function createReviewStore(storage: StorageLike | null): ReviewStore {
  let locked = false;

  return {
    load() {
      locked = false;
      let text: string | null;
      try {
        text = storage?.getItem(REVIEWS_KEY) ?? null;
      } catch {
        return {
          book: emptyBook(),
          error: 'Browser storage is not available; reviews last until reload.',
        };
      }
      if (text === null) return { book: emptyBook(), error: null };
      let drafts: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(text) as Partial<StoredReviews>;
        drafts = parsed.drafts && typeof parsed.drafts === 'object' ? parsed.drafts : {};
      } catch {
        // decodeReviewEnvelope reports the parse error below.
      }
      const decoded = decodeReviewEnvelope(text);
      if (!decoded.ok) {
        locked = true;
        return {
          book: emptyBook(),
          error: `Stored reviews are unreadable and were left untouched (${decoded.error.slice(0, 200)}). Nothing is deleted unless you choose Reset.`,
        };
      }
      const records = new Map(decoded.value.map((r) => [exactKey(r), r] as const));
      const draftMap = new Map(
        Object.entries(drafts).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      );
      return { book: { records, drafts: draftMap }, error: null };
    },
    save(book) {
      if (locked) {
        return { ok: false, error: 'Stored reviews are unreadable; reset them before saving.' };
      }
      if (!storage) return { ok: false, error: 'Browser storage is not available.' };
      const stored: StoredReviews = {
        schemaVersion: 1,
        kind: 'vibe-coder-music-reviews',
        records: [...book.records.values()],
        drafts: Object.fromEntries(book.drafts),
      };
      try {
        storage.setItem(REVIEWS_KEY, JSON.stringify(stored));
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: isQuota(error)
            ? 'Browser storage is full: this review is kept until reload. Export your reviews.'
            : `Reviews could not be saved: ${String(error)}`,
        };
      }
    },
    reset() {
      locked = false;
      try {
        storage?.setItem(
          REVIEWS_KEY,
          JSON.stringify({
            schemaVersion: 1,
            kind: 'vibe-coder-music-reviews',
            records: [],
            drafts: {},
          }),
        );
      } catch {
        // Nothing else to do: the next save reports the problem.
      }
    },
  };
}
