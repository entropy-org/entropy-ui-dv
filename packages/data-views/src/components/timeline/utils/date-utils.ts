import {
  addDays,
  addMinutes,
  addMonths,
  addWeeks,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  endOfDay,
  endOfWeek,
  format,
  getDate,
  isSameDay,
  isSameMonth,
  isSameYear,
  isWeekend,
  startOfDay,
  startOfMinute,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import type { ViewportMode } from "../types.js"

/**
 * Zoom changes visual density, not date granularity. Hours use quarter-hour
 * columns; every other mode uses calendar-day columns.
 */
export function alignToColumnStart(date: Date, mode: ViewportMode): Date {
  if (mode !== "hours") return startOfDay(date)

  const aligned = startOfMinute(date)
  aligned.setMinutes(Math.floor(aligned.getMinutes() / 15) * 15)
  return aligned
}

export function addOneColumnUnit(date: Date, mode: ViewportMode): Date {
  return mode === "hours" ? addMinutes(date, 15) : addDays(date, 1)
}

export function countColumns(
  start: Date,
  end: Date,
  mode: ViewportMode
): number {
  return mode === "hours"
    ? differenceInMinutes(end, start) / 15
    : differenceInDays(end, start)
}

export function getPrimaryHeaderLabel(date: Date, mode: ViewportMode): string {
  if (mode === "hours") return format(date, "EEE MMM d")
  return format(date, mode === "year" ? "MMM yyyy" : "MMMM yyyy")
}

export function getSecondaryHeaderLabel(
  date: Date,
  mode: ViewportMode
): string {
  return mode === "hours"
    ? date.getMinutes() === 0
      ? format(date, "ha").toLowerCase()
      : format(date, "h:mma").toLowerCase()
    : String(getDate(date))
}

export function generateColumnDates(
  start: Date,
  end: Date,
  mode: ViewportMode
): Date[] {
  const dates: Date[] = []
  let current = alignToColumnStart(start, mode)

  while (current < end) {
    dates.push(current)
    current = addOneColumnUnit(current, mode)
  }

  return dates
}

export {
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfWeek,
  addDays,
  addWeeks,
  addMonths,
  isSameDay,
  isSameMonth,
  isSameYear,
  isWeekend,
  format,
  differenceInDays,
  differenceInHours,
}
