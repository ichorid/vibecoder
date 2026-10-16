/**
 * Explicit save migrations. Version 1 is the first released format, so the only migration is
 * identity; add a real step (and a fixture in tests/fixtures/saves/) when the format changes.
 */
export const CURRENT_SCHEMA_VERSION = 1;

export type MigrationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; unsupported: boolean; reason: string };

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
  return { ok: true, value: envelope };
}
