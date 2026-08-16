import type {
  CalendarDate,
  CalendarWeekStartsOn,
} from "../types.js"
import {
  addCalendarDays,
  formatCalendarDateLabel,
  getDayOfWeek,
  getVisibleDateRange,
  parseCalendarDate,
  startOfMonth,
} from "./date-engine.js"

export interface CalendarDateGridCell {
  readonly date: CalendarDate
  readonly year: number
  readonly month: number
  readonly dayOfMonth: number
  readonly dayOfWeek: CalendarWeekStartsOn
  readonly weekIndex: number
  readonly dayIndex: number
  readonly visibleColumnIndex: number | null
  readonly isCurrentMonth: boolean
  readonly isWeekend: boolean
  readonly isVisible: boolean
  readonly weekdayLabel: string
  readonly dayLabel: string
}

export interface CalendarDateGridRow {
  readonly rowIndex: number
  readonly startDate: CalendarDate
  readonly endDate: CalendarDate
  readonly cells: readonly CalendarDateGridCell[]
  readonly visibleCells: readonly CalendarDateGridCell[]
}

export interface CalendarDateGrid {
  readonly anchorDate: CalendarDate
  readonly startDate: CalendarDate
  readonly endDate: CalendarDate
  readonly rowCount: number
  readonly cells: readonly CalendarDateGridCell[]
  readonly rows: readonly CalendarDateGridRow[]
}

export interface BuildDateGridOptions {
  readonly weekStartsOn: CalendarWeekStartsOn
  readonly showWeekends: boolean
  readonly locale?: string
}

function buildGrid(
  anchorDate: CalendarDate,
  mode: "month" | "week",
  options: BuildDateGridOptions
): CalendarDateGrid {
  const range = getVisibleDateRange(anchorDate, mode, options.weekStartsOn)
  const anchorMonth = parseCalendarDate(startOfMonth(anchorDate))
  const cells: CalendarDateGridCell[] = []
  const rows: CalendarDateGridRow[] = []

  for (let rowIndex = 0; rowIndex < range.rowCount; rowIndex += 1) {
    const rowCells: CalendarDateGridCell[] = []
    let visibleColumnIndex = 0
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = addCalendarDays(range.startDate, rowIndex * 7 + dayIndex)
      const parts = parseCalendarDate(date)
      const dayOfWeek = getDayOfWeek(date)
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const isVisible = options.showWeekends || !isWeekend
      const cell: CalendarDateGridCell = {
        date,
        ...parts,
        dayOfMonth: parts.day,
        dayOfWeek,
        weekIndex: rowIndex,
        dayIndex,
        visibleColumnIndex: isVisible ? visibleColumnIndex : null,
        isCurrentMonth:
          parts.year === anchorMonth.year && parts.month === anchorMonth.month,
        isWeekend,
        isVisible,
        weekdayLabel: formatCalendarDateLabel(date, options.locale, {
          weekday: "short",
        }),
        dayLabel: formatCalendarDateLabel(date, options.locale, {
          day: "numeric",
        }),
      }
      if (isVisible) visibleColumnIndex += 1
      rowCells.push(cell)
      cells.push(cell)
    }
    rows.push({
      rowIndex,
      startDate: rowCells[0].date,
      endDate: rowCells[6].date,
      cells: rowCells,
      visibleCells: rowCells.filter((cell) => cell.isVisible),
    })
  }

  return {
    anchorDate,
    startDate: range.startDate,
    endDate: range.endDate,
    rowCount: range.rowCount,
    cells,
    rows,
  }
}

export function buildMonthGrid(
  anchorDate: CalendarDate,
  options: BuildDateGridOptions
): CalendarDateGrid {
  return buildGrid(anchorDate, "month", options)
}

export function buildWeekGrid(
  anchorDate: CalendarDate,
  options: BuildDateGridOptions
): CalendarDateGrid {
  return buildGrid(anchorDate, "week", options)
}
