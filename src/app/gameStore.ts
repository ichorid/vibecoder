/**
 * Svelte-compatible readable store holding one committed snapshot. Only app composition can
 * publish; subscribers receive deeply frozen values in development.
 */
export type Subscriber<T> = (value: T) => void;
export type Unsubscribe = () => void;

export interface Readable<T> {
  subscribe(subscriber: Subscriber<T>): Unsubscribe;
}

export interface SnapshotStore<T> extends Readable<T> {
  get(): T;
  publish(value: T): void;
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

export function createSnapshotStore<T>(initial: T, freeze: boolean): SnapshotStore<T> {
  let current = freeze ? deepFreeze(initial) : initial;
  const subscribers = new Set<Subscriber<T>>();
  return {
    get: () => current,
    publish(value) {
      current = freeze ? deepFreeze(value) : value;
      for (const subscriber of [...subscribers]) subscriber(current);
    },
    subscribe(subscriber) {
      subscribers.add(subscriber);
      subscriber(current);
      return () => {
        subscribers.delete(subscriber);
      };
    },
  };
}
