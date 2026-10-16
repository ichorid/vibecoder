/**
 * Acceptance fixture: exhaustive command handling must reject unknown variants.
 * Compiled via tsconfig.game.json once implementer wires tools/type-fixtures.
 */
import type { GameCommand } from '../../../../src/game/types';

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

export function routeCommand(command: GameCommand): string {
  switch (command.type) {
    case 'launchRockets':
      return 'ok';
    default:
      return 'leak';
  }
}
