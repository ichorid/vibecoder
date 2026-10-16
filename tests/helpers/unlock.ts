import type { Catalog } from '../../src/game/catalog';
import type { TechnologyId } from '../../src/game/ids';
import { resolveDiscoveries } from '../../src/game/progression';
import type { RunState } from '../../src/game/types';

/**
 * Local unit-test shortcut (plan §4: small explicit states near a threshold are allowed for
 * unit tests, never for route/ending scenarios): mark progression upgrades bought and resolve
 * discoveries through the real transaction, then acknowledge them.
 */
export function withTechnologies(
  run: RunState,
  ids: readonly TechnologyId[],
  catalog: Catalog,
): RunState {
  let next = run;
  for (const id of ids) {
    const upgrade = catalog.upgrades.find((u) => u.discovers === id);
    if (!upgrade) throw new Error(`no upgrade discovers ${id}`);
    next = { ...next, upgradeLevels: { ...next.upgradeLevels, [upgrade.id]: 1 } };
    next = resolveDiscoveries(next, catalog).run;
    next = { ...next, pendingUnlockIds: [] };
  }
  return next;
}
