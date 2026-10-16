import type { RunStatus } from '../../../../src/game/types';

export function isPlaying(status: RunStatus): boolean {
  return status === 'playing';
}
