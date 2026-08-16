import React, { useCallback, useMemo } from "react"
import type { CalendarPointerInteractions } from "../hooks/use-calendar-pointer-interactions.js"
import { useCalendarStore } from "../hooks/use-calendar-store.js"
import { selectActions } from "../store/selectors.js"
import type { CalendarState } from "../types.js"
import type { CalendarDateGridCell } from "../utils/date-grid.js"
import { CalendarDayCell } from "./calendar-day-cell.js"

export interface CalendarDayCellContainerProps {
  readonly cell: CalendarDateGridCell
  readonly dateLabel?: string
  readonly currentMonth: boolean
  readonly today: boolean
  readonly creating: boolean
  readonly showWeekday: boolean
  readonly defaultTabStop: boolean
  readonly pointer: CalendarPointerInteractions
}

export const CalendarDayCellContainer = React.memo(
  function CalendarDayCellContainer({
    cell,
    dateLabel,
    currentMonth,
    today,
    creating,
    showWeekday,
    defaultTabStop,
    pointer,
  }: CalendarDayCellContainerProps) {
    const actions = useCalendarStore(selectActions)
    const tabStopSelector = useMemo(
      () => (state: CalendarState) =>
        state.focusedDate === cell.date ||
        (state.focusedDate === null && defaultTabStop),
      [cell.date, defaultTabStop]
    )
    const isTabStop = useCalendarStore(tabStopSelector)
    const focusDate = useCallback(
      () => actions.setFocusedDate(cell.date),
      [actions, cell.date]
    )
    const beginCreate = useCallback(
      (event: React.PointerEvent<HTMLElement>) =>
        pointer.beginCreate(event, cell.date),
      [cell.date, pointer]
    )

    return (
      <CalendarDayCell
        cell={cell}
        dateLabel={dateLabel}
        currentMonth={currentMonth}
        today={today}
        creating={creating}
        showWeekday={showWeekday}
        aria-colindex={(cell.visibleColumnIndex ?? 0) + 1}
        tabIndex={isTabStop ? 0 : -1}
        onFocus={focusDate}
        onClick={focusDate}
        onPointerDown={beginCreate}
      />
    )
  }
)
