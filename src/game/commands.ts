import type { GameCommand } from './types';

export type CommandResult = 'applied' | 'unavailable';

export function applyCommand(_command: GameCommand): CommandResult {
  return 'unavailable';
}
