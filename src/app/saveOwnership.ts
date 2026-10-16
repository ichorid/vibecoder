/**
 * One writing tab per save (architecture §7). With Web Locks the first tab holds an exclusive
 * lock for its whole life; another tab does not boot the game at all — it waits, and boots from
 * the then-latest save once the lock is granted, so it never continues from a stale copy.
 * Without Web Locks ownership is best effort: a `storage` event carrying a newer save revision
 * tells the older tab to stop. Simultaneous first writes in that fallback are not prevented.
 */
export const SAVE_LOCK = 'vibe-coder.save';

export interface LockManagerLike {
  request(
    name: string,
    options: { ifAvailable?: boolean },
    callback: (lock: unknown) => unknown,
  ): Promise<unknown>;
}

export interface OwnershipHandlers {
  /** This tab may run and write the game. Called once. */
  onOwner(): void;
  /** Another tab owns the save; show a waiting panel. */
  onWaiting(): void;
}

export interface OwnershipClaim {
  /** True when no lock API exists (ownership is only best effort). */
  readonly bestEffort: boolean;
  release(): void;
}

export function claimSaveOwnership(
  locks: LockManagerLike | undefined,
  handlers: OwnershipHandlers,
): OwnershipClaim {
  if (!locks) {
    handlers.onOwner();
    return { bestEffort: true, release() {} };
  }
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let owner = false;
  const become = () => {
    if (owner) return held;
    owner = true;
    handlers.onOwner();
    return held;
  };
  void locks.request(SAVE_LOCK, { ifAvailable: true }, (lock) => {
    if (lock) return become();
    handlers.onWaiting();
    void locks.request(SAVE_LOCK, {}, () => become());
    return undefined;
  });
  return { bestEffort: false, release: () => release() };
}

/** Fallback: call `onForeign` when another tab stores a save newer than ours. */
export function watchForeignWrites(
  target: EventTarget,
  key: string,
  ownRevision: () => number,
  onForeign: (revision: number) => void,
): () => void {
  const listener = (event: Event) => {
    const { key: changed, newValue } = event as Event & {
      key?: string | null;
      newValue?: string | null;
    };
    if (changed !== key || !newValue) return;
    let revision: unknown;
    try {
      revision = (JSON.parse(newValue) as { revision?: unknown }).revision;
    } catch {
      return;
    }
    if (typeof revision === 'number' && revision > ownRevision()) onForeign(revision);
  };
  target.addEventListener('storage', listener);
  return () => target.removeEventListener('storage', listener);
}
