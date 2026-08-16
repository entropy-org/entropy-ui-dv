import type {
  DataListDisplayEntry,
  DataListReorderCommand,
} from "../types.js"

export interface DataListReorderDestination {
  readonly targetId: string
  readonly position: "before" | "after"
}

export function resolveReorderCommand<TData>(
  entries: readonly Extract<
    DataListDisplayEntry<TData>,
    { readonly kind: "item" }
  >[],
  movedIds: readonly string[],
  destination: DataListReorderDestination,
  mutationId: string
): DataListReorderCommand | null {
  const moved = new Set(movedIds)
  const remaining = entries.filter((entry) => !moved.has(entry.item.id))
  const targetIndex = remaining.findIndex(
    (entry) => entry.item.id === destination.targetId
  )
  if (targetIndex < 0 || movedIds.length === 0) return null
  const insertionIndex =
    destination.position === "before" ? targetIndex : targetIndex + 1
  const before = remaining[insertionIndex]
  const after = remaining[insertionIndex - 1]
  const target = remaining[targetIndex]

  const originalOrder = entries.map((entry) => entry.item.id)
  const nextOrder = remaining.map((entry) => entry.item.id)
  nextOrder.splice(insertionIndex, 0, ...movedIds)
  if (
    nextOrder.length === originalOrder.length &&
    nextOrder.every((id, index) => id === originalOrder[index])
  ) {
    return null
  }

  return {
    type: "reorder",
    itemIds: movedIds,
    beforeId: before?.item.id,
    afterId: after?.item.id,
    destinationGroupKey: target.groupKey,
    destinationParentId: target.item.parentId,
    mutationId,
  }
}

export function isManualReorderEnabled(options: {
  readonly readOnly: boolean
  readonly hasHandler: boolean
  readonly operationsMode: "client" | "server"
  readonly hasSort: boolean
  readonly hasFilters: boolean
  readonly query: string
  readonly serverAllowed: boolean
}) {
  if (options.readOnly || !options.hasHandler) return false
  if (options.operationsMode === "server") return options.serverAllowed
  return !options.hasSort && !options.hasFilters && options.query.length === 0
}
