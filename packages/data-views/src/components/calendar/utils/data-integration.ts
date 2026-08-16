import type {
  CalendarConfig,
  CalendarDataPresentation,
  CalendarDataStatus,
  CalendarItem,
  CalendarMutationCommand,
  CalendarPermissions,
  CalendarRange,
  CalendarSource,
  CalendarQueryRange,
} from "../types.js"
import { getAgendaVisibleSpan } from "./agenda.js"
import {
  buildMonthGrid,
  buildWeekGrid,
} from "./date-grid.js"

export function getCalendarVisibleRange(
  anchorDate: string,
  preferences: CalendarConfig["preferences"]
): CalendarQueryRange {
  const gridOptions = {
    weekStartsOn: preferences.weekStartsOn,
    showWeekends: preferences.showWeekends,
  }
  const span =
    preferences.viewMode === "agenda"
      ? getAgendaVisibleSpan(
          anchorDate,
          preferences.agenda.span,
          preferences.weekStartsOn,
          preferences.showWeekends
        )
      : preferences.viewMode === "month"
        ? buildMonthGrid(anchorDate, gridOptions)
        : buildWeekGrid(anchorDate, gridOptions)
  const range = {
    startDate: span.startDate,
    endDate: span.endDate,
    timeZone: preferences.timeZone,
    viewMode: preferences.viewMode,
  } as const
  return { ...range, key: createCalendarVisibleRangeKey(range) }
}

export function createCalendarVisibleRangeKey(
  range: Omit<CalendarQueryRange, "key">
): string {
  return JSON.stringify([
    "calendar-range-v1",
    range.viewMode,
    range.startDate,
    range.endDate,
    range.timeZone,
  ])
}

export function resolveCalendarDataPresentation(
  visibleRange: CalendarQueryRange,
  dataState: CalendarDataStatus | undefined
): CalendarDataPresentation {
  if (!dataState) {
    return {
      status: "ready",
      busy: false,
      blocksContent: false,
      partial: false,
    }
  }
  if (dataState.rangeKey !== visibleRange.key) {
    return {
      status: "stale",
      busy: true,
      blocksContent: true,
      partial: false,
    }
  }
  if (dataState.status === "loading") {
    return {
      status: "loading",
      busy: true,
      blocksContent: true,
      partial: false,
    }
  }
  if (dataState.status === "error") {
    return {
      status: "error",
      busy: false,
      blocksContent: !dataState.hasUsableData,
      partial: dataState.hasUsableData,
      error: dataState.error,
    }
  }
  return {
    status: dataState.status,
    busy: dataState.status === "refreshing",
    blocksContent: false,
    partial: dataState.coverage === "partial",
  }
}

function permissionValue(
  permissions: CalendarPermissions | undefined,
  capability: keyof CalendarPermissions
): boolean {
  return permissions?.[capability] !== false
}

export function canViewCalendarItem(
  item: CalendarItem,
  permissions?: CalendarPermissions,
  sources: readonly CalendarSource[] = []
): boolean {
  if (!permissionValue(permissions, "view")) return false
  if (!permissionValue(item.permissions, "view")) return false
  if (!item.calendarId) return true
  const source = sources.find(({ id }) => id === item.calendarId)
  return !source || permissionValue(source.permissions, "view")
}

export function canCreateCalendarItem(config: CalendarConfig): boolean {
  return !config.readOnly && permissionValue(config.permissions, "create")
}

export function canMutateCalendarItem(
  config: CalendarConfig,
  item: CalendarItem,
  capability: "update" | "delete" | "duplicate" | "convert"
): boolean {
  if (config.readOnly || !permissionValue(config.permissions, capability)) {
    return false
  }
  if (!permissionValue(item.permissions, capability)) return false
  const source = item.calendarId
    ? getConfiguredCalendarSources(config).find(
        ({ id }) => id === item.calendarId
      )
    : undefined
  return !source || permissionValue(source.permissions, capability)
}

export function canExecuteCalendarCommand(
  config: CalendarConfig,
  command: CalendarMutationCommand
): boolean {
  if (config.readOnly) return false
  const itemById = new Map(config.items.map((item) => [item.id, item]))
  const capability =
    command.type === "delete" || command.type === "restore"
      ? "delete"
      : "update"
  const itemIds =
    command.type === "move"
      ? command.changes.map(({ itemId }) => itemId)
      : command.type === "resize"
        ? [command.itemId]
        : command.itemIds
  return itemIds.every((itemId) => {
    const item = itemById.get(itemId)
    return item
      ? canMutateCalendarItem(config, item, capability)
      : permissionValue(config.permissions, capability)
  })
}

/** Pure helper for TanStack Query `onMutate`; snapshots/rollback stay in Query. */
export function applyCalendarCommandOptimistically(
  items: readonly CalendarItem[],
  command: CalendarMutationCommand,
  restoredItems: readonly CalendarItem[] = []
): CalendarItem[] {
  if (command.type === "delete") {
    const deleted = new Set(command.itemIds)
    return items.filter((item) => !deleted.has(item.id))
  }
  if (command.type === "restore") {
    const currentIds = new Set(items.map(({ id }) => id))
    const requested = new Set(command.itemIds)
    return [
      ...items,
      ...restoredItems.filter(
        (item) => requested.has(item.id) && !currentIds.has(item.id)
      ),
    ]
  }
  if (command.type === "resize") {
    return items.map((item) =>
      item.id === command.itemId
        ? applyOptimisticRange(item, command.nextRange)
        : item
    )
  }
  const ranges = new Map(
    command.changes.map(({ itemId, nextRange }) => [itemId, nextRange])
  )
  return items.map((item) => {
    const range = ranges.get(item.id)
    return range ? applyOptimisticRange(item, range) : item
  })
}

function applyOptimisticRange(
  item: CalendarItem,
  range: CalendarRange
): CalendarItem {
  if (item.kind === "all-day" && range.kind === "all-day") {
    return { ...item, startDate: range.startDate, endDate: range.endDate }
  }
  if (item.kind === "timed" && range.kind === "timed") {
    return { ...item, start: range.start, end: range.end }
  }
  return item
}

/** Keeps the first valid stable source ID and reports IDs the caller must fix. */
export function normalizeCalendarSources(sources: readonly CalendarSource[]): {
  readonly sources: readonly CalendarSource[]
  readonly invalidIds: readonly string[]
} {
  const seen = new Set<string>()
  const valid: CalendarSource[] = []
  const invalidIds: string[] = []
  for (const source of sources) {
    const id = source.id.trim()
    if (!id || seen.has(id)) {
      invalidIds.push(source.id)
      continue
    }
    seen.add(id)
    valid.push(source)
  }
  return { sources: valid, invalidIds }
}

export function getConfiguredCalendarSources(
  config: Pick<CalendarConfig, "sources" | "agenda">
): readonly CalendarSource[] {
  return (
    config.sources ??
    (config.agenda?.sidebar?.type === "default"
      ? config.agenda.sidebar.calendars
      : [])
  )
}
