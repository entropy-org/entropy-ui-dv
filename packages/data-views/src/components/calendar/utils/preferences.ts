import type {
  CalendarPreferences,
  CalendarPreferencesChange,
} from "../types.js"

function stringArraysEqual(
  first: readonly string[],
  second: readonly string[]
): boolean {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  )
}

function assertValidPreferenceChange(change: CalendarPreferencesChange) {
  if (
    change.type === "max-visible-lanes" &&
    (!Number.isInteger(change.value) || change.value < 0)
  ) {
    throw new RangeError(
      "Maximum visible lanes must be a non-negative integer."
    )
  }
  if (change.type === "time-zone") {
    new Intl.DateTimeFormat("en-US", { timeZone: change.value }).format()
  }
  if (
    change.type === "agenda-hour-height" &&
    (!Number.isFinite(change.value) || change.value < 32 || change.value > 240)
  ) {
    throw new RangeError("Agenda hour height must be between 32 and 240 pixels.")
  }
  if (
    change.type === "agenda-initial-scroll" &&
    (!Number.isInteger(change.value) || change.value < 0 || change.value > 1439)
  ) {
    throw new RangeError("Agenda initial scroll must be a minute from 0 through 1439.")
  }
}

/** Applies one controlled preference intent without mutating the input. */
export function applyCalendarPreferenceChange(
  preferences: CalendarPreferences,
  change: CalendarPreferencesChange
): CalendarPreferences {
  assertValidPreferenceChange(change)

  switch (change.type) {
    case "view-mode":
      return preferences.viewMode === change.value
        ? preferences
        : { ...preferences, viewMode: change.value }
    case "week-start":
      return preferences.weekStartsOn === change.value
        ? preferences
        : { ...preferences, weekStartsOn: change.value }
    case "weekends":
      return preferences.showWeekends === change.value
        ? preferences
        : { ...preferences, showWeekends: change.value }
    case "density":
      return preferences.density === change.value
        ? preferences
        : { ...preferences, density: change.value }
    case "max-visible-lanes":
      return preferences.maxVisibleLanes === change.value
        ? preferences
        : { ...preferences, maxVisibleLanes: change.value }
    case "overflow-behavior":
      return preferences.overflowBehavior === change.value
        ? preferences
        : { ...preferences, overflowBehavior: change.value }
    case "visible-calendars":
      return stringArraysEqual(preferences.visibleCalendarIds, change.value)
        ? preferences
        : { ...preferences, visibleCalendarIds: [...change.value] }
    case "time-zone":
      return preferences.timeZone === change.value
        ? preferences
        : { ...preferences, timeZone: change.value }
    case "time-format":
      return preferences.timeFormat === change.value
        ? preferences
        : { ...preferences, timeFormat: change.value }
    case "agenda-span":
      return { ...preferences, agenda: { ...preferences.agenda, span: change.value } }
    case "agenda-snap":
      return { ...preferences, agenda: { ...preferences.agenda, snapMinutes: change.value } }
    case "agenda-hour-height":
      return { ...preferences, agenda: { ...preferences.agenda, hourHeight: change.value } }
    case "agenda-working-hours":
      return { ...preferences, agenda: { ...preferences.agenda, workingHours: change.value } }
    case "agenda-initial-scroll":
      return { ...preferences, agenda: { ...preferences.agenda, initialScrollMinutes: change.value } }
    case "agenda-all-day-section":
      return { ...preferences, agenda: { ...preferences.agenda, showAllDaySection: change.value } }
  }
}
