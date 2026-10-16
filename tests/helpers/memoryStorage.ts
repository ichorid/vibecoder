/** In-memory Storage subset with switchable failure modes for persistence tests. */
export interface MemoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  failWrites: boolean;
  writes: number;
  data: Map<string, string>;
}

export function createMemoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const data = new Map(Object.entries(initial));
  const storage: MemoryStorage = {
    data,
    failWrites: false,
    writes: 0,
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      if (storage.failWrites) throw new DOMException('quota', 'QuotaExceededError');
      storage.writes += 1;
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
  return storage;
}
