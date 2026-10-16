/**
 * Bank compatibility: every allowed neighbour pair in an interchangeability group (including
 * bag rollover, so all ordered pairs) must share the clock and have an allowed exit → entry
 * boundary. Sharing a key alone is not enough.
 */
import type { NormalizedPattern } from './validation';

export interface BoundaryRules {
  /** Allowed [exitGroup, entryGroup] pairs. */
  readonly allowed: readonly (readonly [string, string])[];
}

const clockKey = (p: NormalizedPattern) =>
  `${p.bpm}|${p.timeSignature.numerator}/${p.timeSignature.denominator}|${p.stepsPerBar}|${p.bars}`;

export function pairAllowed(
  from: NormalizedPattern,
  to: NormalizedPattern,
  rules: BoundaryRules,
): boolean {
  return rules.allowed.some(([exit, entry]) => exit === from.exitGroup && entry === to.entryGroup);
}

export function checkBankCompatibility(
  patterns: readonly NormalizedPattern[],
  rules: BoundaryRules,
): string[] {
  const problems: string[] = [];
  const reference = patterns[0];
  if (!reference) return problems;
  for (const pattern of patterns) {
    if (clockKey(pattern) !== clockKey(reference)) {
      problems.push(
        `${pattern.id}@${pattern.revision}: clock ${clockKey(pattern)} differs from ${clockKey(reference)}`,
      );
    }
  }
  for (const from of patterns) {
    for (const to of patterns) {
      if (!pairAllowed(from, to, rules)) {
        problems.push(
          `${from.id}@${from.revision} → ${to.id}@${to.revision}: boundary ${from.exitGroup} → ${to.entryGroup} not allowed`,
        );
      }
    }
  }
  return problems;
}

/** Boundary policy shared by the demo banks: any phrase may start on the tonic. */
export const DEFAULT_BOUNDARY_RULES: BoundaryRules = {
  allowed: [
    ['tonic', 'tonic'],
    ['dominant', 'tonic'],
  ],
};
