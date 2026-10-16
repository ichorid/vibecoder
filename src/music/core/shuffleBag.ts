/**
 * Shuffle-bag selection: every candidate once per bag, in a seeded weighted permutation
 * (weights order the bag, they never add copies; weight 0 excludes). No immediate repeat
 * across a bag boundary when at least two candidates exist. Serializable state.
 */
import { nextRandom } from './random';

export interface BagCandidate {
  /** Exact version key, e.g. `discovery-a@1`. */
  readonly key: string;
  readonly weight: number;
}

export interface BagState {
  readonly rng: number;
  readonly order: readonly string[];
  readonly index: number;
  readonly last: string | null;
  /** Candidate set the current order was built from (sorted keys). */
  readonly members: readonly string[];
}

export type BagResult =
  | { readonly status: 'ok'; readonly key: string; readonly state: BagState }
  | { readonly status: 'unavailable'; readonly key: null; readonly state: BagState };

export function createBag(seed: number): BagState {
  return { rng: seed >>> 0, order: [], index: 0, last: null, members: [] };
}

export function validWeight(weight: number): boolean {
  return Number.isFinite(weight) && weight >= 0;
}

/** Weighted permutation without replacement (Efraimidis–Spirakis keys). */
function permute(
  candidates: readonly BagCandidate[],
  rng: number,
): { order: string[]; rng: number } {
  let state = rng;
  const keyed = candidates.map((candidate) => {
    const draw = nextRandom(state);
    state = draw.state;
    const u = Math.max(draw.value, 1e-12);
    return { key: candidate.key, sort: Math.log(u) / candidate.weight };
  });
  keyed.sort((a, b) => b.sort - a.sort || a.key.localeCompare(b.key));
  return { order: keyed.map((k) => k.key), rng: state };
}

export function nextFromBag(state: BagState, candidates: readonly BagCandidate[]): BagResult {
  const usable = candidates.filter((c) => validWeight(c.weight) && c.weight > 0);
  if (usable.length === 0) return { status: 'unavailable', key: null, state };
  const members = usable.map((c) => c.key).sort();
  let current = state;
  const changed = members.join('\u0000') !== state.members.join('\u0000');
  if (changed || current.index >= current.order.length) {
    const fresh = permute(usable, current.rng);
    const order = [...fresh.order];
    // Avoid an immediate repeat across the boundary.
    if (order.length > 1 && order[0] === current.last) {
      const first = order[0];
      order[0] = order[1] ?? first;
      order[1] = first;
    }
    current = { rng: fresh.rng, order, index: 0, last: current.last, members };
  }
  const key = current.order[current.index] ?? null;
  if (key === null) return { status: 'unavailable', key: null, state: current };
  return { status: 'ok', key, state: { ...current, index: current.index + 1, last: key } };
}
