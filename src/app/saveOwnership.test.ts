import { describe, expect, it } from 'vitest';
import { claimSaveOwnership, watchForeignWrites, type LockManagerLike } from './saveOwnership';

/** A tiny in-memory Web Locks model: exclusive, FIFO, `ifAvailable` honoured. */
function fakeLocks() {
  let held = false;
  const queue: (() => void)[] = [];
  const locks: LockManagerLike = {
    request(_name, options, callback) {
      const run = () => {
        held = true;
        return Promise.resolve(callback({ name: 'vibe-coder.save' })).finally(() => {
          held = false;
          queue.shift()?.();
        });
      };
      if (!held) return run();
      if (options.ifAvailable) return Promise.resolve(callback(null));
      return new Promise((resolve) => queue.push(() => resolve(run())));
    },
  };
  return locks;
}

/** Let queued promise callbacks run (no timers: scheduling is owned by the runtime). */
async function tick() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

describe('save ownership', () => {
  it('the first tab owns the save; a second waits and takes over when the first releases', async () => {
    const locks = fakeLocks();
    const events: string[] = [];
    const first = claimSaveOwnership(locks, {
      onOwner: () => events.push('first:owner'),
      onWaiting: () => events.push('first:waiting'),
    });
    await tick();
    claimSaveOwnership(locks, {
      onOwner: () => events.push('second:owner'),
      onWaiting: () => events.push('second:waiting'),
    });
    await tick();
    expect(events).toEqual(['first:owner', 'second:waiting']);
    first.release();
    await tick();
    await tick();
    expect(events).toEqual(['first:owner', 'second:waiting', 'second:owner']);
  });

  it('without Web Locks a tab owns the save on a best-effort basis', () => {
    const events: string[] = [];
    const claim = claimSaveOwnership(undefined, {
      onOwner: () => events.push('owner'),
      onWaiting: () => events.push('waiting'),
    });
    expect(events).toEqual(['owner']);
    expect(claim.bestEffort).toBe(true);
  });

  it('the fallback notices a newer save written by another tab', () => {
    const target = new EventTarget();
    let own = 3;
    const seen: number[] = [];
    const stop = watchForeignWrites(
      target,
      'vibe-coder.save',
      () => own,
      (revision) => seen.push(revision),
    );
    const write = (revision: number | null, key = 'vibe-coder.save') => {
      const event = new Event('storage') as Event & { key: string; newValue: string | null };
      Object.assign(event, {
        key,
        newValue: revision === null ? null : JSON.stringify({ revision }),
      });
      target.dispatchEvent(event);
    };
    write(3);
    write(2);
    write(9, 'other-key');
    write(4);
    own = 10;
    write(5);
    stop();
    write(99);
    expect(seen).toEqual([4]);
  });
});
