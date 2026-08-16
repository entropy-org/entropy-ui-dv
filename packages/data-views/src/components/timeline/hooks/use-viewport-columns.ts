/**
 * Hook: compute the timeline's column layout from store state.
 *
 * Maintains an extendable horizontal canvas, virtualizes the visible
 * columns, and preserves the visible dates when columns are prepended.
 *
 */
import { useLayoutEffect, useMemo } from "react"
import { useTimelineStore } from "./use-timeline-store.js"
import { generateColumnDates } from "../utils/date-utils.js"
import { getColumnWidth } from "../utils/viewport-config.js"
import {
  TIMELINE_EXTENSION_THRESHOLD_PX,
  VIRTUAL_COLUMN_BUFFER,
} from "../constants.js"
import { extendTimelineCanvasRange } from "../utils/timeline-range.js"
import { dateToPx } from "../utils/position-utils.js"

/** Result of the viewport columns computation */
export interface ViewportColumnsResult {
  /** Timeline origin — left-most column-aligned date */
  origin: Date
  /** All column-start dates from origin through end of range */
  columns: Date[]
  /** Index of the first returned column in the full timeline range */
  columnStartIndex: number
  /** Number of columns in the full timeline range */
  totalColumnCount: number
  /** Total content width in pixels */
  totalWidth: number
  /** Column width in pixels for the current mode */
  columnWidth: number
}

/** Inputs for the pure virtual column range calculation. */
export interface VirtualColumnRangeOptions {
  scrollLeft: number
  viewportWidth: number
  columnWidth: number
  columnCount: number
  buffer?: number
}

/** Inclusive virtualized column indexes. */
export interface VirtualColumnRange {
  startIndex: number
  endIndex: number
}

/**
 * Calculate the inclusive visible column range with overscan.
 */
export function computeVirtualColumnRange({
  scrollLeft,
  viewportWidth,
  columnWidth,
  columnCount,
  buffer = VIRTUAL_COLUMN_BUFFER,
}: VirtualColumnRangeOptions): VirtualColumnRange {
  if (columnCount <= 0) return { startIndex: 0, endIndex: -1 }
  if (viewportWidth <= 0 || columnWidth <= 0) {
    return { startIndex: 0, endIndex: columnCount - 1 }
  }

  const firstVisible = Math.min(
    columnCount - 1,
    Math.max(0, Math.floor(scrollLeft / columnWidth))
  )
  const lastVisible = Math.min(
    columnCount - 1,
    Math.max(
      firstVisible,
      Math.ceil((scrollLeft + viewportWidth) / columnWidth) - 1
    )
  )

  return {
    startIndex: Math.max(0, firstVisible - buffer),
    endIndex: Math.min(columnCount - 1, lastVisible + buffer),
  }
}

/**
 * Compute the full column layout for the current timeline state.
 *
 * @returns Origin, column dates, total width, and column width
 */
export function useViewportColumns(): ViewportColumnsResult {
  const viewportMode = useTimelineStore((s) => s.viewportMode)
  const timelineOrigin = useTimelineStore((s) => s.timelineOrigin)
  const timelineEnd = useTimelineStore((s) => s.timelineEnd)
  const items = useTimelineStore((s) => s.items)
  const scrollLeft = useTimelineStore((s) => s.scrollLeft)
  const viewportWidth = useTimelineStore((s) => s.viewportWidth)
  const setTimelineRange = useTimelineStore((s) => s.actions.setTimelineRange)

  const activeRange = useMemo(
    () => ({ origin: timelineOrigin, end: timelineEnd }),
    [timelineEnd, timelineOrigin]
  )

  useLayoutEffect(() => {
    let nextRange = activeRange
    let changed = false

    for (const item of items.values()) {
      while (item.startDate < nextRange.origin) {
        nextRange = extendTimelineCanvasRange(nextRange, viewportMode, "left")
        changed = true
      }
      while (item.endDate > nextRange.end) {
        nextRange = extendTimelineCanvasRange(nextRange, viewportMode, "right")
        changed = true
      }
    }

    if (!changed) return

    const prependedWidth = dateToPx(
      activeRange.origin,
      nextRange.origin,
      viewportMode
    )
    setTimelineRange(
      nextRange.origin,
      nextRange.end,
      prependedWidth > 0 ? scrollLeft + prependedWidth : undefined
    )
  }, [activeRange, items, scrollLeft, setTimelineRange, viewportMode])

  const layout = useMemo(() => {
    const colWidth = getColumnWidth(viewportMode)
    const allColumns = generateColumnDates(
      activeRange.origin,
      activeRange.end,
      viewportMode
    )
    const totalWidth = allColumns.length * colWidth

    return {
      allColumns,
      columnWidth: colWidth,
      origin: activeRange.origin,
      totalWidth,
    }
  }, [activeRange, viewportMode])

  useLayoutEffect(() => {
    if (viewportWidth <= 0) return

    const nearLeftEdge = scrollLeft < TIMELINE_EXTENSION_THRESHOLD_PX
    const nearRightEdge =
      scrollLeft + viewportWidth >
      layout.totalWidth - TIMELINE_EXTENSION_THRESHOLD_PX

    if (!nearLeftEdge && !nearRightEdge) return

    if (nearLeftEdge) {
      const range = extendTimelineCanvasRange(activeRange, viewportMode, "left")
      const addedWidth = dateToPx(
        activeRange.origin,
        range.origin,
        viewportMode
      )
      setTimelineRange(range.origin, range.end, scrollLeft + addedWidth)
      return
    }

    const range = extendTimelineCanvasRange(activeRange, viewportMode, "right")
    setTimelineRange(range.origin, range.end)
  }, [
    activeRange,
    layout.columnWidth,
    layout.totalWidth,
    scrollLeft,
    setTimelineRange,
    viewportMode,
    viewportWidth,
  ])

  return useMemo(() => {
    const range = computeVirtualColumnRange({
      scrollLeft,
      viewportWidth,
      columnWidth: layout.columnWidth,
      columnCount: layout.allColumns.length,
    })
    const columns =
      range.endIndex < range.startIndex
        ? []
        : layout.allColumns.slice(range.startIndex, range.endIndex + 1)

    return {
      origin: layout.origin,
      columns,
      columnStartIndex: range.startIndex,
      totalColumnCount: layout.allColumns.length,
      totalWidth: layout.totalWidth,
      columnWidth: layout.columnWidth,
    }
  }, [layout, scrollLeft, viewportWidth])
}
