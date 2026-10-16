// Simulated src/ui/HistoryView.svelte.ts
import type { HistoryViewModel } from '../game/selectors';

export function entries(vm: HistoryViewModel): readonly string[] {
  return vm.entries;
}
