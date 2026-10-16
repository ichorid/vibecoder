/**
 * Acceptance fixture: pure game code must not reference DOM globals.
 */
export function readTitle(): string {
  return document.title;
}
