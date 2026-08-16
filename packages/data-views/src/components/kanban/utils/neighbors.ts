import type { KanbanNeighbors } from "../types.js"

export function getKanbanNeighbors(
  orderedIds: readonly string[],
  insertionIndex: number,
  excludedIds: ReadonlySet<string> = new Set()
): KanbanNeighbors {
  const available = orderedIds.filter((id) => !excludedIds.has(id))
  const index = Math.max(0, Math.min(insertionIndex, available.length))
  return {
    beforeId: available[index - 1] ?? null,
    afterId: available[index] ?? null,
  }
}
