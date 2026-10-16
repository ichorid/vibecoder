// Simulated src/game/economy.ts — internal game imports only
import { applyCommand } from '../commands';
import type { RunStatus } from '../types';

export function statusLabel(status: RunStatus): string {
  return status === 'playing' ? 'live' : 'done';
}

export function noop(): typeof applyCommand {
  return applyCommand;
}
