// Simulated src/ui/UnlockAnnouncement.svelte.ts
import type { GameViewModel } from '../game/selectors';

export function visibleUnlock(vm: GameViewModel): string | null {
  return vm.pendingUnlockTitle;
}
