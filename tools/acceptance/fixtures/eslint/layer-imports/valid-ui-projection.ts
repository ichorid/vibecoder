// Simulated src/ui/GameView.svelte.ts — public read models only
import type { GameViewModel } from '../game/selectors';

export function label(vm: GameViewModel): string {
  return vm.primaryActionLabel;
}
