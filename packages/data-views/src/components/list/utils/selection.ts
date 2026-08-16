import type { DataListInternalSelection } from "../store/types.js"

export function isItemSelected(
  selection: DataListInternalSelection,
  itemId: string
) {
  return selection.kind === "explicit"
    ? selection.ids.has(itemId)
    : !selection.excludedIds.has(itemId)
}

export function replaceSelection(itemId: string): DataListInternalSelection {
  return { kind: "explicit", ids: new Set([itemId]) }
}

export function toggleSelection(
  selection: DataListInternalSelection,
  itemId: string
): DataListInternalSelection {
  if (selection.kind === "all-matching") {
    const excludedIds = new Set(selection.excludedIds)
    if (excludedIds.has(itemId)) excludedIds.delete(itemId)
    else excludedIds.add(itemId)
    return { ...selection, excludedIds }
  }
  const ids = new Set(selection.ids)
  if (ids.has(itemId)) ids.delete(itemId)
  else ids.add(itemId)
  return { kind: "explicit", ids }
}

export function rangeSelection(
  selection: DataListInternalSelection,
  visibleIds: readonly string[],
  anchorId: string | null,
  itemId: string
): DataListInternalSelection {
  const anchorIndex = anchorId ? visibleIds.indexOf(anchorId) : -1
  const itemIndex = visibleIds.indexOf(itemId)
  if (anchorIndex < 0 || itemIndex < 0) return replaceSelection(itemId)
  const from = Math.min(anchorIndex, itemIndex)
  const to = Math.max(anchorIndex, itemIndex)
  const ids =
    selection.kind === "explicit" ? new Set(selection.ids) : new Set<string>()
  for (let index = from; index <= to; index += 1) {
    ids.add(visibleIds[index])
  }
  return { kind: "explicit", ids }
}

export function getSelectedCount(
  selection: DataListInternalSelection,
  matchingCount: number
) {
  return selection.kind === "explicit"
    ? selection.ids.size
    : Math.max(
        0,
        (selection.matchingCount ?? matchingCount) - selection.excludedIds.size
      )
}
