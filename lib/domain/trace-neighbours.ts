interface Identified {
  id: number;
}

// Prev/next for arrow navigation through a selected list. Orders by id so the
// sequence is stable regardless of how the caller's array happens to be sorted.
// Returns nulls at either end, when nothing is selected, and when the selected id
// isn't in the list — the caller renders those as disabled arrows.
export function getNeighbourIds(
  items: readonly Identified[],
  activeId: number | null
): { prevId: number | null; nextId: number | null } {
  const none = { prevId: null, nextId: null };
  if (activeId === null) return none;

  const sorted = [...items].sort((a, b) => a.id - b.id);
  const i = sorted.findIndex((item) => item.id === activeId);
  if (i === -1) return none;

  return {
    prevId: i > 0 ? sorted[i - 1].id : null,
    nextId: i < sorted.length - 1 ? sorted[i + 1].id : null,
  };
}
