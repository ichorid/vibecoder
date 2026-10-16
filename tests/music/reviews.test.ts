import { describe, expect, it } from 'vitest';
import {
  approvedKeys,
  decide,
  decodeReviewEnvelope,
  emptyBook,
  encodeReviewEnvelope,
  mergeImport,
  resolveConflict,
  reviewFor,
} from '../../src/music-lab/reviews';
import { createReviewStore, REVIEWS_KEY } from '../../src/music-lab/reviewStore';

function first<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error('expected an item');
  return item;
}

const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);
const version = (hash = H1) => ({ patternId: 'disc-a', revision: 1, contentHash: hash });
const NOW = '2026-10-16T12:00:00.000Z';

function ok<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  let full = false;
  return {
    data,
    fill: () => (full = true),
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (full) throw new DOMException('quota', 'QuotaExceededError');
      data.set(k, v);
    },
  };
}

describe('review decisions', () => {
  it('rating 1–5 is optional before the first decision; decisions bind to the exact version', () => {
    let book = emptyBook();
    expect(reviewFor(book, version())).toMatchObject({ status: 'unreviewed', stale: false });
    book = ok(decide(book, version(), { rating: 4 }, NOW, true));
    expect(reviewFor(book, version())).toMatchObject({ status: 'unreviewed', rating: 4 });
    expect(decide(book, version(), { rating: 6 }, NOW, true).ok).toBe(false);
    expect(decide(book, version(), { rating: 2.5 }, NOW, true).ok).toBe(false);
    book = ok(decide(book, version(), { status: 'approved' }, NOW, true));
    expect(reviewFor(book, version())).toMatchObject({ status: 'approved', rating: 4 });
    book = ok(decide(book, version(), { status: 'revise', feedback: 'more bass' }, NOW, true));
    expect(reviewFor(book, version())).toMatchObject({ status: 'revise', feedback: 'more bass' });
  });

  it('a hard-invalid payload cannot be approved but can be rejected', () => {
    const book = emptyBook();
    expect(decide(book, version(), { status: 'approved' }, NOW, false).ok).toBe(false);
    expect(decide(book, version(), { status: 'rejected' }, NOW, false).ok).toBe(true);
  });

  it('a changed payload is stale: id + revision without the same hash is not approved', () => {
    const book = ok(decide(emptyBook(), version(H1), { status: 'approved' }, NOW, true));
    expect(reviewFor(book, version(H2))).toMatchObject({ status: 'unreviewed', stale: true });
    expect(approvedKeys(book, new Map([['disc-a@1', H1]]))).toEqual(new Set(['disc-a@1']));
    expect(approvedKeys(book, new Map([['disc-a@1', H2]]))).toEqual(new Set());
  });

  it('records are immutable: deciding returns a new book', () => {
    const before = emptyBook();
    const after = ok(decide(before, version(), { status: 'rejected' }, NOW, true));
    expect(reviewFor(before, version()).status).toBe('unreviewed');
    expect(Object.isFrozen(after.records.get(`disc-a@1#${H1}`))).toBe(true);
  });
});

describe('review exchange', () => {
  it('export → import round-trips and a repeated import is idempotent', () => {
    const book = ok(decide(emptyBook(), version(), { status: 'approved', rating: 5 }, NOW, true));
    const text = encodeReviewEnvelope(book);
    const decoded = ok(decodeReviewEnvelope(text));
    const first = mergeImport(emptyBook(), decoded);
    expect(first).toMatchObject({ added: 1, identical: 0, conflicts: [] });
    const second = mergeImport(first.book, decoded);
    expect(second).toMatchObject({ added: 0, identical: 1, conflicts: [] });
  });

  it('rejects invalid status, hash, rating range and oversized files before parsing', () => {
    const envelope = (record: unknown) =>
      JSON.stringify({ schemaVersion: 1, kind: 'vibe-coder-music-reviews', records: [record] });
    const good = { schemaVersion: 1, ...version(), status: 'approved' };
    expect(decodeReviewEnvelope(envelope(good)).ok).toBe(true);
    expect(decodeReviewEnvelope(envelope({ ...good, status: 'great' })).ok).toBe(false);
    expect(decodeReviewEnvelope(envelope({ ...good, contentHash: 'abc' })).ok).toBe(false);
    expect(decodeReviewEnvelope(envelope({ ...good, rating: 0 })).ok).toBe(false);
    expect(decodeReviewEnvelope('{"schemaVersion":1,').ok).toBe(false);
    const huge = 'x'.repeat(2 * 1024 * 1024 + 1);
    const result = decodeReviewEnvelope(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/too large/);
  });

  it('a different decision for the same exact key needs an explicit choice', () => {
    const local = ok(decide(emptyBook(), version(), { status: 'approved' }, NOW, true));
    const theirs = ok(
      decide(emptyBook(), version(), { status: 'rejected', feedback: 'no' }, NOW, true),
    );
    const merged = mergeImport(local, ok(decodeReviewEnvelope(encodeReviewEnvelope(theirs))));
    expect(merged.conflicts).toHaveLength(1);
    expect(reviewFor(merged.book, version()).status).toBe('approved');
    const conflict = first(merged.conflicts);
    expect(reviewFor(resolveConflict(merged.book, conflict, 'keep-local'), version()).status).toBe(
      'approved',
    );
    expect(reviewFor(resolveConflict(merged.book, conflict, 'use-import'), version()).status).toBe(
      'rejected',
    );
  });

  it('a new version never overwrites the previous one or its feedback', () => {
    const old = ok(
      decide(emptyBook(), version(H1), { status: 'revise', feedback: 'keep me' }, NOW, true),
    );
    const next = ok(decide(emptyBook(), version(H2), { status: 'approved' }, NOW, true));
    const merged = mergeImport(old, ok(decodeReviewEnvelope(encodeReviewEnvelope(next))));
    expect(merged.conflicts).toEqual([]);
    expect(reviewFor(merged.book, version(H1)).feedback).toBe('keep me');
    expect(reviewFor(merged.book, version(H2)).status).toBe('approved');
  });
});

describe('review storage', () => {
  it('persists decisions and feedback drafts across reloads', () => {
    const storage = memory();
    const store = createReviewStore(storage);
    let book = ok(decide(store.load().book, version(), { status: 'revise' }, NOW, true));
    book = { ...book, drafts: new Map([[`disc-a@1#${H1}`, 'half a thought']]) };
    expect(store.save(book)).toEqual({ ok: true });
    const reloaded = createReviewStore(storage).load();
    expect(reloaded.error).toBeNull();
    expect(reviewFor(reloaded.book, version()).status).toBe('revise');
    expect(reloaded.book.drafts.get(`disc-a@1#${H1}`)).toBe('half a thought');
  });

  it('corrupt storage is reported, never silently replaced, and leaves other keys alone', () => {
    const storage = memory({
      [REVIEWS_KEY]: '{broken',
      'vibe-coder.save': '{"game":1}',
      'vibecoder.audio.v1': '{"schemaVersion":1,"soundOn":true,"volume":0.5}',
    });
    const store = createReviewStore(storage);
    const loaded = store.load();
    expect(loaded.error).toMatch(/unreadable/);
    expect(
      store.save(ok(decide(loaded.book, version(), { status: 'approved' }, NOW, true))),
    ).toMatchObject({
      ok: false,
    });
    expect(storage.data.get(REVIEWS_KEY)).toBe('{broken');
    expect(storage.data.get('vibe-coder.save')).toBe('{"game":1}');
    store.reset();
    expect(store.load().error).toBeNull();
  });

  it('a full quota keeps the in-memory decision and reports the error', () => {
    const storage = memory();
    const store = createReviewStore(storage);
    storage.fill();
    const result = store.save(
      ok(decide(emptyBook(), version(), { status: 'approved' }, NOW, true)),
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/full/i);
  });
});
