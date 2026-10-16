/**
 * Structural validation of untrusted pattern JSON against the canonical local JSON Schema
 * (draft 2020-12, Ajv). Size/count limits are checked before anything expensive.
 */
import Ajv2020 from 'ajv/dist/2020';
import patternSchema from '../../../music/PATTERN_SCHEMA.json';
import type { PatternDocument } from '../data/patterns.generated';

export interface StructuralError {
  readonly path: string;
  readonly message: string;
}

export interface StructuralResult<T> {
  readonly value: T | null;
  readonly errors: readonly StructuralError[];
}

/** Hard input limits (sound plan §3). */
export const LIMITS = {
  patternBytes: 256 * 1024,
  batchBytes: 2 * 1024 * 1024,
  eventsPerPattern: 1024,
  feedbackBytes: 8 * 1024,
} as const;

const ajv = new Ajv2020({ allErrors: true, strict: true });
const checkPattern = ajv.compile<PatternDocument>(patternSchema);

/** Compile a further local schema with the same Ajv instance (era/preset/review documents). */
export function compileSchema<T>(schema: object) {
  return ajv.compile<T>(schema);
}

export function toErrors(
  errors:
    readonly { instancePath: string; message?: string; params?: unknown }[] | null | undefined,
): StructuralError[] {
  return (errors ?? []).map((error) => {
    const extra =
      error.params && typeof error.params === 'object' && 'additionalProperty' in error.params
        ? ` (${String(error.params.additionalProperty)})`
        : '';
    return { path: error.instancePath || '/', message: `${error.message ?? 'invalid'}${extra}` };
  });
}

export function validatePatternStructure(value: unknown): StructuralResult<PatternDocument> {
  if (checkPattern(value)) {
    const events = Object.values(value.tracks).reduce(
      (sum, track) => sum + (track?.length ?? 0),
      0,
    );
    if (events > LIMITS.eventsPerPattern) {
      return {
        value: null,
        errors: [{ path: '/tracks', message: `more than ${LIMITS.eventsPerPattern} events` }],
      };
    }
    return { value, errors: [] };
  }
  return { value: null, errors: toErrors(checkPattern.errors) };
}
