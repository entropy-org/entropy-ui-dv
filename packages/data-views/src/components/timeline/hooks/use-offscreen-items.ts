/**
 * Hook: compute offscreen item counts and nearest items.
 *
 * Scans all items and buckets them into left/right offscreen
 * based on the current viewport scroll position and dimensions.
 */
import { useMemo } from "react"
import { useTimelineStore } from "./use-timeline-store.js"
import { dateToPx } from "../utils/position-utils.js"
import type { TimelineItem, ViewportMode } from "../types.js"

/** Result of offscreen item analysis */
export interface OffscreenResult {
  /** Number of items entirely to the left of the viewport */
  leftCount: number
  /** Number of items entirely to the right of the viewport */
  rightCount: number
  /** Nearest item to the left viewport edge (by endDate), or null */
  nearestLeft: TimelineItem | null
  /** Nearest item to the right viewport edge (by startDate), or null */
  nearestRight: TimelineItem | null
}

/**
 * Pure computation of offscreen items.
 * Exported for direct testing without hooks.
 */
export function computeOffscreenItems(
  items: Map<string, TimelineItem>,
  origin: Date,
  viewportMode: ViewportMode,
  scrollLeft: number,
  viewportWidth: number
): OffscreenResult {
  const viewportRight = scrollLeft + viewportWidth

  let leftCount = 0
  let rightCount = 0
  let nearestLeft: TimelineItem | null = null
  let nearestLeftDistance = Infinity
  let nearestRight: TimelineItem | null = null
  let nearestRightDistance = Infinity

  for (const item of items.values()) {
    const barLeft = dateToPx(item.startDate, origin, viewportMode)
    const barRight = dateToPx(item.endDate, origin, viewportMode)

    if (barRight < scrollLeft) {
      // Entire bar is to the left of viewport
      leftCount++
      const distance = scrollLeft - barRight
      if (distance < nearestLeftDistance) {
        nearestLeftDistance = distance
        nearestLeft = item
      }
    } else if (barLeft > viewportRight) {
      // Entire bar is to the right of viewport
      rightCount++
      const distance = barLeft - viewportRight
      if (distance < nearestRightDistance) {
        nearestRightDistance = distance
        nearestRight = item
      }
    }
  }

  return { leftCount, rightCount, nearestLeft, nearestRight }
}

/**
 * Compute offscreen item counts and nearest items for the current viewport.
 *
 * @param origin - Timeline origin date (from useViewportColumns)
 * @returns OffscreenResult with counts and nearest items per side
 */
export function useOffscreenItems(origin: Date): OffscreenResult {
  const items = useTimelineStore((s) => s.items)
  const viewportMode = useTimelineStore((s) => s.viewportMode)
  const scrollLeft = useTimelineStore((s) => s.scrollLeft)
  const viewportWidth = useTimelineStore((s) => s.viewportWidth)

  return useMemo(
    () =>
      computeOffscreenItems(
        items,
        origin,
        viewportMode,
        scrollLeft,
        viewportWidth
      ),
    [items, origin, viewportMode, scrollLeft, viewportWidth]
  )
}
