/**
 * Row virtualization helpers for the timeline.
 *
 * Only rows intersecting the viewport, plus a small overscan buffer, are
 * mounted. Spacer heights keep the scrollable surface identical to the
 * non-virtualized layout.
 */
import { useMemo, type RefObject } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { VIRTUAL_ROW_BUFFER } from "../constants.js"
import { useTimelineStore } from "./use-timeline-store.js"

/** Inputs used to calculate a virtual row window. */
export interface VirtualRowRangeOptions {
  scrollTop: number
  viewportHeight: number
  rowHeight: number
  itemCount: number
  buffer?: number
}

/** The mounted row range and its compensating spacer heights. */
export interface VirtualRowRange {
  startIndex: number
  endIndex: number
  topSpacerHeight: number
  bottomSpacerHeight: number
}

/**
 * Calculate the inclusive virtual row range for a scroll position.
 */
export function computeVirtualRowRange({
  scrollTop,
  viewportHeight,
  rowHeight,
  itemCount,
  buffer = VIRTUAL_ROW_BUFFER,
}: VirtualRowRangeOptions): VirtualRowRange {
  if (itemCount <= 0) {
    return {
      startIndex: 0,
      endIndex: -1,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
    }
  }

  // Before the viewport has been measured, render everything. This keeps SSR
  // and test environments deterministic without sacrificing browser runtime
  // virtualization once ResizeObserver reports real dimensions.
  if (viewportHeight <= 0 || rowHeight <= 0) {
    return {
      startIndex: 0,
      endIndex: itemCount - 1,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
    }
  }

  const firstVisible = Math.min(
    itemCount - 1,
    Math.max(0, Math.floor(scrollTop / rowHeight))
  )
  const lastVisible = Math.min(
    itemCount - 1,
    Math.max(
      firstVisible,
      Math.ceil((scrollTop + viewportHeight) / rowHeight) - 1
    )
  )
  const startIndex = Math.max(0, firstVisible - buffer)
  const endIndex = Math.min(itemCount - 1, lastVisible + buffer)

  return {
    startIndex,
    endIndex,
    topSpacerHeight: startIndex * rowHeight,
    bottomSpacerHeight: Math.max(0, (itemCount - endIndex - 1) * rowHeight),
  }
}

/**
 * Select and calculate the currently mounted row range.
 *
 * @param itemCount - Total number of display rows.
 * @param stickyOffset - Height occupied by the sticky header.
 */
export function useVirtualRows(
  itemCount: number,
  stickyOffset = 0,
  scrollElementRef?: RefObject<HTMLElement | null>
): VirtualRowRange {
  const scrollTop = useTimelineStore((state) => state.scrollTop)
  const viewportHeight = useTimelineStore((state) => state.viewportHeight)
  const rowHeight = useTimelineStore((state) => state.rowHeight)
  // TanStack Virtual intentionally returns imperative functions; it is the
  // virtualization boundary and should not be React-Compiler memoized.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: scrollElementRef ? itemCount : 0,
    getScrollElement: () => scrollElementRef?.current ?? null,
    estimateSize: () => rowHeight,
    overscan: VIRTUAL_ROW_BUFFER,
    scrollMargin: stickyOffset,
  })
  const virtualItems = virtualizer.getVirtualItems()

  return useMemo(() => {
    if (virtualItems.length > 0) {
      const startIndex = virtualItems[0].index
      const endIndex = virtualItems[virtualItems.length - 1].index
      return {
        startIndex,
        endIndex,
        topSpacerHeight: startIndex * rowHeight,
        bottomSpacerHeight: Math.max(0, (itemCount - endIndex - 1) * rowHeight),
      }
    }
    return computeVirtualRowRange({
      scrollTop,
      viewportHeight: Math.max(0, viewportHeight - stickyOffset),
      rowHeight,
      itemCount,
    })
  }, [
    itemCount,
    rowHeight,
    scrollTop,
    stickyOffset,
    viewportHeight,
    virtualItems,
  ])
}
