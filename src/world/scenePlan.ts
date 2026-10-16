/**
 * Pure reveal planning: which authored additions to build statically, which one to reveal with
 * animation, and which technologies frame the camera. Rebuilding from unlocked IDs after a
 * reload gives the same scene; a pending discovery waits until Game is visible.
 */
import { presentAdditions } from '../content/world';

export interface PlanInput {
  readonly technologyIds: readonly string[];
  readonly pendingRevealId: string | null;
}

export interface ScenePlan {
  readonly build: readonly string[];
  readonly reveal: string | null;
  /** Technology IDs whose additions are (or are about to be) visible. */
  readonly envelopeIds: readonly string[];
}

export function planScene(
  built: ReadonlySet<string>,
  input: PlanInput,
  active: boolean,
): ScenePlan {
  const present = presentAdditions(input.technologyIds);
  const pending = present.find(
    (a) => a.technologyId !== null && a.technologyId === input.pendingRevealId,
  );
  const build: string[] = [];
  let reveal: string | null = null;
  for (const addition of present) {
    if (built.has(addition.id)) continue;
    if (addition === pending) {
      if (active && built.size + build.length > 0) reveal = addition.id;
      continue;
    }
    build.push(addition.id);
  }
  const visible = new Set([...built, ...build, ...(reveal ? [reveal] : [])]);
  const envelopeIds = present
    .filter((a) => a.technologyId !== null && visible.has(a.id))
    .map((a) => a.technologyId ?? '');
  return { build, reveal, envelopeIds };
}
