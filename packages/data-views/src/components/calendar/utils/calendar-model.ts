import type {
  CalendarDate,
  CalendarItem,
  CalendarInteraction,
  CalendarPendingCommand,
  CalendarPreferences,
  CalendarRange,
  CalendarPermissions,
  CalendarSource,
} from "../types.js"
import {
  CALENDAR_NO_VISIBLE_SOURCES,
  MAX_EXPANDED_CALENDAR_LANES,
} from "../constants.js"
import {
  buildMonthGrid,
  buildWeekGrid,
  type CalendarDateGrid,
} from "./date-grid.js"
import {
  formatCalendarDateLabel,
  parseCalendarDate,
} from "./date-engine.js"
import {
  layoutDateLanes,
  type CalendarLaneLayout,
} from "./date-lanes.js"
import {
  filterCalendarItems,
  type CalendarSearchTextResolver,
} from "./search.js"
import {
  normalizeCalendarItems,
  type NormalizeCalendarItemsResult,
} from "./normalize-items.js"
import { canViewCalendarItem } from "./data-integration.js"

export interface CalendarRenderModel {
  readonly items: readonly CalendarItem[]
  readonly normalized: NormalizeCalendarItemsResult
  readonly grid: CalendarDateGrid
  readonly lanes: CalendarLaneLayout
  readonly orderedItemIds: readonly string[]
  readonly maxVisibleLanes: number
}

function applyRange(item: CalendarItem, range: CalendarRange): CalendarItem {
  if (item.kind !== range.kind) return item
  return item.kind === "all-day" && range.kind === "all-day"
    ? { ...item, startDate: range.startDate, endDate: range.endDate }
    : item.kind === "timed" && range.kind === "timed"
      ? { ...item, start: range.start, end: range.end }
      : item
}

/** Applies pending range/deletion presentation without owning item records. */
export function applyPendingCalendarItems(
  items: readonly CalendarItem[],
  pendingCommands: readonly CalendarPendingCommand[]
): CalendarItem[] {
  const latest = new Map<string, CalendarPendingCommand["expected"][number]>()
  for (const pending of pendingCommands) {
    for (const expectation of pending.expected) {
      latest.set(expectation.itemId, expectation)
    }
  }

  return items.flatMap((item) => {
    const expectation = latest.get(item.id)
    if (expectation?.type === "absent") return []
    if (expectation?.type === "range") {
      return [applyRange(item, expectation.range)]
    }
    return [item]
  })
}

export function applyInteractionCalendarItems(
  items: readonly CalendarItem[],
  interaction: CalendarInteraction | undefined
): CalendarItem[] {
  if (
    !interaction ||
    interaction.type === "idle" ||
    interaction.type === "creating"
  ) {
    return [...items]
  }

  const ranges = new Map<string, CalendarRange>()
  if (interaction.type === "moving") {
    for (const change of interaction.preview) {
      ranges.set(change.itemId, change.nextRange)
    }
  } else {
    ranges.set(interaction.itemId, interaction.preview)
  }
  return items.map((item) => {
    const range = ranges.get(item.id)
    return range ? applyRange(item, range) : item
  })
}

export function filterVisibleCalendars(
  items: readonly CalendarItem[],
  visibleCalendarIds: readonly string[]
): CalendarItem[] {
  if (visibleCalendarIds.length === 0) return [...items]
  if (visibleCalendarIds.includes(CALENDAR_NO_VISIBLE_SOURCES)) {
    return items.filter((item) => item.calendarId === undefined)
  }
  const visible = new Set(visibleCalendarIds)
  return items.filter(
    (item) => item.calendarId === undefined || visible.has(item.calendarId)
  )
}

export interface BuildCalendarRenderModelOptions {
  readonly anchorDate: CalendarDate
  readonly items: readonly CalendarItem[]
  readonly pendingCommands: readonly CalendarPendingCommand[]
  readonly preferences: CalendarPreferences
  readonly locale?: string
  readonly maxSpanDays?: number
  readonly searchQuery: string
  readonly getSearchText?: CalendarSearchTextResolver
  readonly interaction?: CalendarInteraction
  readonly permissions?: CalendarPermissions
  readonly sources?: readonly CalendarSource[]
}

export function buildCalendarRenderModel(
  options: BuildCalendarRenderModelOptions
): CalendarRenderModel {
  const permittedItems = options.items.filter((item) =>
    canViewCalendarItem(item, options.permissions, options.sources)
  )
  const pendingItems = applyPendingCalendarItems(
    permittedItems,
    options.pendingCommands
  )
  const interactionItems = applyInteractionCalendarItems(
    pendingItems,
    options.interaction
  )
  const calendarItems = filterVisibleCalendars(
    interactionItems,
    options.preferences.visibleCalendarIds
  )
  const searchedItems = filterCalendarItems(
    calendarItems,
    options.searchQuery,
    options.getSearchText
  )
  const normalized = normalizeCalendarItems(searchedItems, {
    timeZone: options.preferences.timeZone,
    maxSpanDays: options.maxSpanDays,
  })
  const gridOptions = {
    weekStartsOn: options.preferences.weekStartsOn,
    showWeekends: options.preferences.showWeekends,
    locale: options.locale,
  }
  const grid =
    options.preferences.viewMode === "month"
      ? buildMonthGrid(options.anchorDate, gridOptions)
      : buildWeekGrid(options.anchorDate, gridOptions)
  const visibleNormalizedItems = normalized.items.filter(
    ({ dateSpan }) =>
      dateSpan.endDate >= grid.startDate && dateSpan.startDate <= grid.endDate
  )
  const maxVisibleLanes =
    options.preferences.overflowBehavior === "expand-week"
      ? MAX_EXPANDED_CALENDAR_LANES
      : options.preferences.maxVisibleLanes
  const lanes = layoutDateLanes(
    visibleNormalizedItems,
    grid.rows,
    maxVisibleLanes
  )
  const orderedItemIds = [
    ...new Set(lanes.placements.map(({ item }) => item.item.id)),
  ]
  return {
    items: searchedItems,
    normalized,
    grid,
    lanes,
    orderedItemIds,
    maxVisibleLanes,
  }
}

export function formatCalendarTitle(
  grid: CalendarDateGrid,
  viewMode: CalendarPreferences["viewMode"],
  locale?: string
): string {
  if (viewMode === "month") {
    return formatCalendarDateLabel(grid.anchorDate, locale, {
      month: "long",
      year: "numeric",
    })
  }

  const sameMonthStart = parseCalendarDate(grid.startDate)
  const sameMonthEnd = parseCalendarDate(grid.endDate)
  if (
    sameMonthStart.year === sameMonthEnd.year &&
    sameMonthStart.month === sameMonthEnd.month
  ) {
    return `${formatCalendarDateLabel(grid.startDate, locale, { month: "short", day: "numeric" })} – ${formatCalendarDateLabel(grid.endDate, locale, { month: "short", day: "numeric", year: "numeric" })}`
  }

  const start = parseCalendarDate(grid.startDate)
  const end = parseCalendarDate(grid.endDate)
  if (start.year === end.year && start.month === end.month) {
    return `${formatCalendarDateLabel(grid.startDate, locale, { month: "short", day: "numeric" })} – ${formatCalendarDateLabel(grid.endDate, locale, { day: "numeric", year: "numeric" })}`
  }
  if (start.year === end.year) {
    return `${formatCalendarDateLabel(grid.startDate, locale, { month: "short", day: "numeric" })} – ${formatCalendarDateLabel(grid.endDate, locale, { month: "short", day: "numeric", year: "numeric" })}`
  }
  return `${formatCalendarDateLabel(grid.startDate, locale, { month: "short", day: "numeric", year: "numeric" })} – ${formatCalendarDateLabel(grid.endDate, locale, { month: "short", day: "numeric", year: "numeric" })}`
}

export function formatTimedItemStart(
  item: CalendarItem,
  locale: string | undefined,
  preferences: Pick<CalendarPreferences, "timeFormat" | "timeZone">
): string | null {
  if (item.kind !== "timed") return null
  return new Intl.DateTimeFormat(locale, {
    timeZone: preferences.timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: preferences.timeFormat === "12h",
  }).format(item.start)
}
