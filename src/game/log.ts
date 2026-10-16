import type { Catalog } from './catalog';
import type { RunState } from './types';

/** Append one ambient log line, keeping only the bounded recent tail in the run. */
export function appendLog(run: RunState, text: string, catalog: Catalog): RunState {
  const log = [...run.log, { text, activeMs: run.activeMs }];
  const limit = catalog.balance.logMemoryLimit;
  return { ...run, log: log.length > limit ? log.slice(log.length - limit) : log };
}
