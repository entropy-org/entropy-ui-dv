import type {
  CalendarPreferences,
  CalendarViewMode,
} from "./types.js"

export const CALENDAR_VIEW_MODES = [
  "month",
  "week",
  "agenda",
] as const satisfies readonly CalendarViewMode[]

export const DEFAULT_CALENDAR_VIEW_MODE: CalendarViewMode = "month"
export const DEFAULT_WEEK_STARTS_ON = 1 as const
export const DEFAULT_MAX_VISIBLE_LANES = 4
export const DEFAULT_MAX_CALENDAR_SPAN_DAYS = 3660
export const DEFAULT_CALENDAR_DENSITY = "compact" as const
export const DEFAULT_OVERFLOW_BEHAVIOR = "popover" as const
export const DEFAULT_TIME_FORMAT = "12h" as const
export const DEFAULT_AGENDA_SNAP_MINUTES = 15 as const
export const DEFAULT_AGENDA_HOUR_HEIGHT = 64
export const DEFAULT_AGENDA_MINIMUM_DAY_WIDTH = 132
export const DEFAULT_AGENDA_TIMED_DURATION_MINUTES = 30
/** Controlled-filter sentinel used to distinguish "none" from empty = "all". */
export const CALENDAR_NO_VISIBLE_SOURCES = "__calendar_no_visible_sources__"
export const MAX_CALENDAR_HISTORY_ENTRIES = 50
export const MIN_CALENDAR_DESKTOP_WIDTH_PX = 960
/** Hard safety cap for the opt-in expanded layout. */
export const MAX_EXPANDED_CALENDAR_LANES = 50

export function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

export function createDefaultCalendarPreferences(
  timeZone = getBrowserTimeZone()
): CalendarPreferences {
  return {
    viewMode: DEFAULT_CALENDAR_VIEW_MODE,
    weekStartsOn: DEFAULT_WEEK_STARTS_ON,
    showWeekends: true,
    density: DEFAULT_CALENDAR_DENSITY,
    maxVisibleLanes: DEFAULT_MAX_VISIBLE_LANES,
    overflowBehavior: DEFAULT_OVERFLOW_BEHAVIOR,
    visibleCalendarIds: [],
    timeZone,
    timeFormat: DEFAULT_TIME_FORMAT,
    agenda: {
      span: { type: "week" },
      snapMinutes: DEFAULT_AGENDA_SNAP_MINUTES,
      hourHeight: DEFAULT_AGENDA_HOUR_HEIGHT,
      workingHours: { startMinutes: 9 * 60, endMinutes: 17 * 60 },
      initialScrollMinutes: 6 * 60,
      showAllDaySection: true,
    },
  }
}
