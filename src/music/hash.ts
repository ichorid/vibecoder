/**
 * SHA-256 over canonical payload bytes, via Web Crypto (browsers in secure contexts — https or
 * localhost — and Node ≥ 19 expose the same `crypto.subtle`). Outside a secure context there is
 * no fallback hash: the Lab reports that reviews need a secure origin.
 */
import type { MusicCatalog } from './core/catalog';
import { canonicalPayload } from './core/canonical';
import type { PatternDocument } from './data/patterns.generated';

export class HashUnavailableError extends Error {
  constructor() {
    super('SHA-256 needs a secure origin (https or localhost) for reviews');
    this.name = 'HashUnavailableError';
  }
}

export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle as SubtleCrypto | undefined;
  if (!subtle) throw new HashUnavailableError();
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const contentHash = (pattern: PatternDocument, catalog: MusicCatalog): Promise<string> =>
  sha256Hex(canonicalPayload(pattern, catalog));
