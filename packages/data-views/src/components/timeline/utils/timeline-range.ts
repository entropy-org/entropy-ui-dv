import type { TimelineItem, ViewportMode } from "../types.js"
import {
  TIMELINE_EXTENSION_TARGET_PX,
  TIMELINE_INITIAL_PADDING_PX,
} from "../constants.js"
import {
  addOneColumnUnit,
  alignToColumnStart,
} from "./date-utils.js"
import { getColumnCountForPixels } from "./viewport-config.js"

/** Stable date bounds for the horizontally scrollable timeline canvas. */
export interface TimelineCanvasRange {
  origin: Date
  end: Date
}

/**
 * Move a column-aligned date by an integer number of viewport columns.
 */
export function shiftColumnUnits(
  date: Date,
  mode: ViewportMode,
  amount: number
): Date {
  let shifted = alignToColumnStart(date, mode)

  if (amount > 0) {
    for (let index = 0; index < amount; index += 1) {
      shifted = addOneColumnUnit(shifted, mode)
    }
    return shifted
  }

  for (let index = 0; index > amount; index -= 1) {
    shifted = alignToColumnStart(new Date(shifted.getTime() - 1), mode)
  }
  return shifted
}

/**
 * Create the initial canvas around the supplied items with room on both sides.
 */
export function createTimelineCanvasRange(
  items: Map<string, TimelineItem>,
  mode: ViewportMode
): TimelineCanvasRange {
  let earliest: Date | null = null
  let latest: Date | null = null

  for (const item of items.values()) {
    if (!earliest || item.startDate < earliest) earliest = item.startDate
    if (!latest || item.endDate > latest) latest = item.endDate
  }

  const fallback = new Date()
  const firstColumn = alignToColumnStart(earliest ?? fallback, mode)
  const lastColumn = alignToColumnStart(latest ?? fallback, mode)
  const paddingColumns = getColumnCountForPixels(
    mode,
    TIMELINE_INITIAL_PADDING_PX
  )

  return {
    origin: shiftColumnUnits(firstColumn, mode, -paddingColumns),
    end: shiftColumnUnits(lastColumn, mode, paddingColumns + 1),
  }
}

/**
 * Extend one side of an existing canvas by the standard batch size.
 */
export function extendTimelineCanvasRange(
  range: TimelineCanvasRange,
  mode: ViewportMode,
  direction: "left" | "right"
): TimelineCanvasRange {
  const batchColumns = getColumnCountForPixels(
    mode,
    TIMELINE_EXTENSION_TARGET_PX
  )

  return direction === "left"
    ? {
        ...range,
        origin: shiftColumnUnits(range.origin, mode, -batchColumns),
      }
    : {
        ...range,
        end: shiftColumnUnits(range.end, mode, batchColumns),
      }
}
