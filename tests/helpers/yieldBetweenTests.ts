/**
 * Whole-run simulations are long synchronous test bodies. Between tests Vitest only awaits
 * microtasks, so a file of them can keep its worker from reading Vitest's RPC replies for over a
 * minute ("Timeout calling onTaskUpdate" on slow CI runners). One macrotask turn before each test
 * lets the worker answer.
 */
import { setImmediate } from 'node:timers/promises';
import { beforeEach } from 'vitest';

beforeEach(async () => {
  await setImmediate();
});
