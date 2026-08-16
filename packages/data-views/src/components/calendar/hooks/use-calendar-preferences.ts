import { useCallback } from "react"
import { useCalendarConfig } from "../context/calendar-config-context.js"
import type {
  CalendarPreferences,
  CalendarPreferencesChange,
} from "../types.js"
import { applyCalendarPreferenceChange } from "../utils/preferences.js"

/** Emits controlled preference intents without mirroring preferences in Zustand. */
export function useCalendarPreferencesChange() {
  const { onPreferencesChange, preferences } = useCalendarConfig()

  return useCallback(
    (change: CalendarPreferencesChange): CalendarPreferences => {
      const next = applyCalendarPreferenceChange(preferences, change)
      if (next !== preferences) onPreferencesChange?.(next, change)
      return next
    },
    [onPreferencesChange, preferences]
  )
}
