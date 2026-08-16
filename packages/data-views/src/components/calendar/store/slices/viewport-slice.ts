import type {
  CalendarDate,
  CalendarViewportActions,
  CalendarViewportSlice,
  CalendarViewMode,
} from "../../types.js"
import {
  addCalendarDays,
  endOfMonth,
  endOfWeek,
  formatCalendarDate,
  parseCalendarDate,
  startOfWeek,
} from "../../utils/date-engine.js"
import type {
  CalendarStoreGet,
  CalendarStoreSet,
  CalendarStoreSlice,
} from "../slice-types.js"

export interface CreateViewportSliceOptions {
  readonly initialAnchorDate: CalendarDate
  readonly initialFocusedDate?: CalendarDate | null
}

function shiftMonthClamped(date: CalendarDate, months: number): CalendarDate {
  const parts = parseCalendarDate(date)
  const monthIndex = parts.year * 12 + parts.month - 1 + months
  const year = Math.floor(monthIndex / 12)
  const month = (((monthIndex % 12) + 12) % 12) + 1
  const firstOfTarget = formatCalendarDate({ year, month, day: 1 })
  const lastDay = parseCalendarDate(endOfMonth(firstOfTarget)).day
  return formatCalendarDate({ year, month, day: Math.min(parts.day, lastDay) })
}

export function getAdjacentCalendarAnchor(
  anchorDate: CalendarDate,
  viewMode: CalendarViewMode,
  direction: "previous" | "next"
): CalendarDate {
  const amount = direction === "previous" ? -1 : 1
  return viewMode === "week" || viewMode === "agenda"
    ? addCalendarDays(anchorDate, amount * 7)
    : shiftMonthClamped(anchorDate, amount)
}

function nonNegativeDimension(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function createViewportSlice(
  options: CreateViewportSliceOptions,
  set: CalendarStoreSet,
  get: CalendarStoreGet
): CalendarStoreSlice<CalendarViewportSlice, CalendarViewportActions> {
  parseCalendarDate(options.initialAnchorDate)
  if (options.initialFocusedDate !== null && options.initialFocusedDate) {
    parseCalendarDate(options.initialFocusedDate)
  }

  return {
    state: {
      anchorDate: options.initialAnchorDate,
      focusedDate: options.initialFocusedDate ?? null,
      viewportWidth: 0,
      viewportHeight: 0,
    },
    actions: {
      setAnchorDate: (date) => {
        parseCalendarDate(date)
        if (get().anchorDate !== date) set({ anchorDate: date })
        return date
      },
      navigateByPeriod: (direction, viewMode) => {
        const next = getAdjacentCalendarAnchor(
          get().anchorDate,
          viewMode,
          direction
        )
        set({ anchorDate: next })
        return next
      },
      goToToday: (date) => {
        parseCalendarDate(date)
        const state = get()
        if (state.anchorDate !== date || state.focusedDate !== date) {
          set({ anchorDate: date, focusedDate: date })
        }
        return date
      },
      setFocusedDate: (date) => {
        if (date !== null) parseCalendarDate(date)
        if (get().focusedDate !== date) set({ focusedDate: date })
      },
      moveFocusedDate: (days) => {
        const state = get()
        const next = addCalendarDays(
          state.focusedDate ?? state.anchorDate,
          days
        )
        if (state.focusedDate !== next) set({ focusedDate: next })
        return next
      },
      moveFocusToWeekBoundary: (edge, weekStartsOn) => {
        const state = get()
        const current = state.focusedDate ?? state.anchorDate
        const next =
          edge === "start"
            ? startOfWeek(current, weekStartsOn)
            : endOfWeek(current, weekStartsOn)
        if (state.focusedDate !== next) set({ focusedDate: next })
        return next
      },
      setViewportDimensions: (width, height) => {
        const viewportWidth = nonNegativeDimension(width)
        const viewportHeight = nonNegativeDimension(height)
        const state = get()
        if (
          state.viewportWidth !== viewportWidth ||
          state.viewportHeight !== viewportHeight
        ) {
          set({ viewportWidth, viewportHeight })
        }
      },
    },
  }
}
