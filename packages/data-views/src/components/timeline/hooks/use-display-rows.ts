/**
 * Hook: compute the display row list based on sub-item mode.
 *
 * Depending on `subItemMode`:
 * - **disabled**: Only top-level items (no `parentId`) are shown.
 * - **flattened**: Children render as extra rows immediately after parent.
 * - **nested**: Parents are collapsible. Expanding or collapsing only changes
 *   child-row visibility; every item keeps its own independent date range.
 */
import { useMemo } from "react"
import { useTimelineStore } from "./use-timeline-store.js"
import { useTimelineConfig } from "../context/timeline-config-context.js"
import { useShallow } from "zustand/react/shallow"
import type { TimelineItem, SubItemMode } from "../types.js"
import { itemMatchesSearch } from "../utils/search-utils.js"

/** A row in the display list with metadata for rendering */
export interface DisplayRow {
  /** The item to render */
  item: TimelineItem
  /** Nesting depth: 0 for top-level, 1 for children */
  depth: number
  /** Whether this is a parent with children */
  isParent: boolean
  /** Whether this parent is expanded (only relevant when isParent=true + nested mode) */
  isExpanded: boolean
}

/**
 * Build a parent→children index from the items map.
 */
function buildChildrenIndex(
  items: Map<string, TimelineItem>,
  itemOrder: string[]
): Map<string, TimelineItem[]> {
  const index = new Map<string, TimelineItem[]>()
  for (const id of itemOrder) {
    const item = items.get(id)
    if (!item?.parentId) continue
    const siblings = index.get(item.parentId) ?? []
    siblings.push(item)
    index.set(item.parentId, siblings)
  }
  return index
}

/**
 * Pure function that computes display rows.
 * Exported for direct testing without hooks.
 */
export function computeDisplayRows(
  items: Map<string, TimelineItem>,
  itemOrder: string[],
  subItemMode: SubItemMode,
  expandedGroups: Set<string>,
  searchQuery = "",
  getSearchText?: (item: TimelineItem) => string,
  canView?: (item: TimelineItem) => boolean
): DisplayRow[] {
  const visibleOrder = canView
    ? itemOrder.filter((id) => {
        const item = items.get(id)
        return item ? canView(item) : false
      })
    : itemOrder
  const childrenIndex = buildChildrenIndex(items, visibleOrder)
  const rows: DisplayRow[] = []
  const isSearching = searchQuery.trim().length > 0

  for (const id of visibleOrder) {
    const item = items.get(id)
    if (!item) continue

    // Skip children in this loop — they're added via their parent
    if (item.parentId) continue

    const children = childrenIndex.get(id) ?? []
    const isParent = children.length > 0
    const parentMatches = itemMatchesSearch(item, searchQuery, getSearchText)
    const matchingChildren = isSearching
      ? children.filter((child) =>
          itemMatchesSearch(child, searchQuery, getSearchText)
        )
      : children

    if (isSearching && !parentMatches && matchingChildren.length === 0) {
      continue
    }

    switch (subItemMode) {
      case "disabled": {
        if (isSearching && !parentMatches) break
        // Only top-level items shown, no children
        rows.push({
          item,
          depth: 0,
          isParent: false,
          isExpanded: false,
        })
        break
      }

      case "flattened": {
        // Keep the parent as context when only one of its children matches.
        rows.push({
          item,
          depth: 0,
          isParent,
          isExpanded: true,
        })
        for (const child of matchingChildren) {
          rows.push({
            item: child,
            depth: 1,
            isParent: false,
            isExpanded: false,
          })
        }
        break
      }

      case "nested": {
        const isExpanded =
          expandedGroups.has(id) || (isSearching && matchingChildren.length > 0)

        if (isParent && !isExpanded) {
          // Collapsed parent: only its children are hidden.
          rows.push({
            item,
            depth: 0,
            isParent: true,
            isExpanded: false,
          })
        } else {
          // Expanded parent or non-parent
          rows.push({
            item,
            depth: 0,
            isParent,
            isExpanded: isParent && isExpanded,
          })
          if (isExpanded) {
            for (const child of matchingChildren) {
              rows.push({
                item: child,
                depth: 1,
                isParent: false,
                isExpanded: false,
              })
            }
          }
        }
        break
      }
    }
  }

  return rows
}

/**
 * Compute the ordered display rows for the timeline.
 *
 * @returns Array of DisplayRow objects for rendering
 */
export type DisplayRowSurface = "rows" | "sidebar"

export function useDisplayRows(
  surface: DisplayRowSurface = "rows"
): DisplayRow[] {
  const items = useTimelineStore((s) => s.items)
  const itemOrder = useTimelineStore(useShallow((s) => s.itemOrder))
  const subItemMode = useTimelineStore((s) =>
    surface === "rows" ? s.rowSubItemMode : s.sidebarSubItemMode
  )
  const expandedGroups = useTimelineStore((s) =>
    surface === "rows" ? s.rowExpandedGroups : s.sidebarExpandedGroups
  )
  const searchQuery = useTimelineStore((s) => s.searchQuery)
  const { getItemPermissions, getSearchText } = useTimelineConfig()
  const canView = useMemo(
    () =>
      getItemPermissions
        ? (item: TimelineItem) => getItemPermissions(item).view !== false
        : undefined,
    [getItemPermissions]
  )

  return useMemo(
    () =>
      computeDisplayRows(
        items,
        itemOrder,
        subItemMode,
        expandedGroups,
        searchQuery,
        getSearchText,
        canView
      ),
    [
      canView,
      expandedGroups,
      getSearchText,
      itemOrder,
      items,
      searchQuery,
      subItemMode,
    ]
  )
}
