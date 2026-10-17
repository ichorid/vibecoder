/**
 * Experience from earlier runs is derived, never accumulated: the sum of the lessons
 * (`EndingDefinition.experience`) over the distinct endings the profile has discovered. Each
 * ending teaches once; with five lesson endings at +10 % the most is +50 %.
 */
import type { Catalog } from './catalog';
import type { DeepReadonly, DiscoveredEnding } from './types';

export function experienceOf(
  endings: readonly DeepReadonly<Pick<DiscoveredEnding, 'id'>>[],
  catalog: Catalog,
): number {
  const ids = new Set(endings.map((e) => e.id));
  const total = catalog.endings
    .filter((e) => ids.has(e.id))
    .reduce((sum, e) => sum + (e.experience ?? 0), 0);
  return Math.round(total * 1000) / 1000;
}

/**
 * The live-frugal lesson, derived the same way: the product of the rent factors
 * (`EndingDefinition.frugal`) over the distinct endings discovered (1 = full rent).
 */
export function frugalOf(
  endings: readonly DeepReadonly<Pick<DiscoveredEnding, 'id'>>[],
  catalog: Catalog,
): number {
  const ids = new Set(endings.map((e) => e.id));
  const factor = catalog.endings
    .filter((e) => ids.has(e.id))
    .reduce((product, e) => product * (e.frugal ?? 1), 1);
  return Math.round(factor * 1000) / 1000;
}
