import { useCallback, useMemo } from "react"
import { useCalendarConfig } from "../context/calendar-config-context.js"
import { useCalendarStoreApi } from "../context/calendar-context.js"
import type { CalendarDate } from "../types.js"
import { getCalendarDateInTimeZone } from "../utils/date-engine.js"
import {
  getAdjacentAgendaAnchor,
  resolveVisibleAgendaDate,
} from "../utils/agenda.js"

export interface CalendarNavigationActions {
  readonly previous: () => CalendarDate
  readonly next: () => CalendarDate
  readonly today: () => CalendarDate
  readonly toDate: (date: CalendarDate) => CalendarDate
}

/** Bridges store navigation to controlled view configuration and callbacks. */
export function useCalendarNavigationActions(): CalendarNavigationActions {
  const store = useCalendarStoreApi()
  const { now, onAnchorDateChange, preferences } = useCalendarConfig()

  const notifyChange = useCallback(
    (previous: CalendarDate, next: CalendarDate) => {
      if (previous !== next) onAnchorDateChange?.(next)
      if (previous !== next) {
        store.getState().actions.announce(`Calendar navigated to ${next}.`)
      }
      return next
    },
    [onAnchorDateChange, store]
  )

  return useMemo(
    () => ({
      previous: () => {
        const previous = store.getState().anchorDate
        const next = preferences.viewMode === "agenda"
          ? store.getState().actions.setAnchorDate(
              getAdjacentAgendaAnchor(previous, preferences.agenda.span, preferences.weekStartsOn, preferences.showWeekends, "previous")
            )
          : store.getState().actions.navigateByPeriod("previous", preferences.viewMode)
        return notifyChange(previous, next)
      },
      next: () => {
        const previous = store.getState().anchorDate
        const next = preferences.viewMode === "agenda"
          ? store.getState().actions.setAnchorDate(
              getAdjacentAgendaAnchor(previous, preferences.agenda.span, preferences.weekStartsOn, preferences.showWeekends, "next")
            )
          : store.getState().actions.navigateByPeriod("next", preferences.viewMode)
        return notifyChange(previous, next)
      },
      today: () => {
        const previous = store.getState().anchorDate
        const today = getCalendarDateInTimeZone(
          now?.() ?? new Date(),
          preferences.timeZone
        )
        const next = store.getState().actions.goToToday(
          preferences.viewMode === "agenda"
            ? resolveVisibleAgendaDate(today, preferences.showWeekends)
            : today
        )
        return notifyChange(previous, next)
      },
      toDate: (date) => {
        const previous = store.getState().anchorDate
        const next = store.getState().actions.setAnchorDate(
          preferences.viewMode === "agenda"
            ? resolveVisibleAgendaDate(date, preferences.showWeekends)
            : date
        )
        return notifyChange(previous, next)
      },
    }),
    [notifyChange, now, preferences, store]
  )
}
