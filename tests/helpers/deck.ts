/** The build deck in jsdom tests: an item is a lane chip or, while it builds, a build row. */
export function deckItem(key: string): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(`[data-lane-key="${key}"]`) ??
    document.querySelector<HTMLElement>(`[data-testid="build-row"][data-key="${key}"]`)
  );
}

export function needDeckItem(key: string): HTMLElement {
  const item = deckItem(key);
  if (!item) throw new Error(`no ${key} in the build deck`);
  return item;
}

/** The build row of a slot (0 unless Worktrees). */
export function buildRow(slot = 0): HTMLElement {
  const row = document.querySelector<HTMLElement>(`[data-build-slot="${slot}"]`);
  if (!row) throw new Error(`no build row for slot ${slot}`);
  return row;
}
