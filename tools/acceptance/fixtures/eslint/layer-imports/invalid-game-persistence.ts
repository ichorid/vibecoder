// Simulated src/game/bad-save.ts
import { decodeSave } from '../../persistence/save';

export function load(raw: unknown) {
  return decodeSave(raw);
}
