import { DEFAULT_MAX_CALENDAR_SPAN_DAYS } from "../constants.js"
import type {
  CalendarDateSpan,
  CalendarInvalidItem,
  CalendarItem,
} from "../types.js"
import {
  getInclusiveDateSpanDays,
  getItemDateSpan,
} from "./date-range.js"
import { validateCalendarItems } from "./invariants.js"

export interface NormalizedCalendarItem {
  readonly item: CalendarItem
  readonly itemIndex: number
  readonly dateSpan: CalendarDateSpan
  readonly spanDays: number
  readonly startSortTime: number | null
}

export interface NormalizeCalendarItemsOptions {
  readonly timeZone: string
  readonly maxSpanDays?: number
}

export interface NormalizeCalendarItemsResult {
  readonly items: readonly NormalizedCalendarItem[]
  readonly invalidItems: readonly CalendarInvalidItem[]
}

function resolveMaxSpanDays(value: number | undefined): number {
  return Number.isInteger(value) && (value ?? 0) > 0
    ? (value as number)
    : DEFAULT_MAX_CALENDAR_SPAN_DAYS
}

/**
 * Converts valid consumer items to immutable layout records. Invalid input is
 * reported and excluded; values are never repaired, clamped, or mutated.
 */
export function normalizeCalendarItems(
  items: readonly CalendarItem[],
  options: NormalizeCalendarItemsOptions
): NormalizeCalendarItemsResult {
  const invalidItems = [...validateCalendarItems(items)]
  const invalidIndexes = new Set(invalidItems.map((issue) => issue.itemIndex))
  const normalized: NormalizedCalendarItem[] = []
  const maxSpanDays = resolveMaxSpanDays(options.maxSpanDays)

  items.forEach((item, itemIndex) => {
    if (invalidIndexes.has(itemIndex)) return

    const dateSpan = getItemDateSpan(item, options.timeZone)
    const spanDays = getInclusiveDateSpanDays(dateSpan)
    if (spanDays > maxSpanDays) {
      invalidItems.push({
        item,
        itemIndex,
        reason: "span-too-long",
        message: `Calendar item "${item.id}" spans ${spanDays} days; the configured maximum is ${maxSpanDays}.`,
      })
      return
    }

    normalized.push({
      item,
      itemIndex,
      dateSpan,
      spanDays,
      startSortTime: item.kind === "timed" ? item.start.getTime() : null,
    })
  })

  return { items: normalized, invalidItems }
}
