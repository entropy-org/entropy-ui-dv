import { TZDate } from "@date-fns/tz"
import type {
  CalendarDate,
  CalendarRange,
} from "../types.js"
import {
  addCalendarDays,
  compareCalendarDates,
  parseCalendarDate,
} from "./date-engine.js"

export function shiftCalendarRangeByDays(
  range: CalendarRange,
  days: number,
  timeZone: string
): CalendarRange {
  if (range.kind === "all-day") {
    return {
      kind: "all-day",
      startDate: addCalendarDays(range.startDate, days),
      endDate: addCalendarDays(range.endDate, days),
    }
  }

  const zonedStart = TZDate.tz(timeZone, range.start)
  zonedStart.setDate(zonedStart.getDate() + days)
  const start = new Date(zonedStart.getTime())
  return {
    kind: "timed",
    start,
    end: new Date(
      start.getTime() + (range.end.getTime() - range.start.getTime())
    ),
  }
}

function instantOnCalendarDate(
  instant: Date,
  date: CalendarDate,
  timeZone: string
): Date {
  const target = parseCalendarDate(date)
  const zoned = TZDate.tz(timeZone, instant)
  zoned.setFullYear(target.year, target.month - 1, target.day)
  return new Date(zoned.getTime())
}

export function resizeCalendarRangeToDate(
  range: CalendarRange,
  edge: "start" | "end",
  date: CalendarDate,
  timeZone: string
): CalendarRange {
  if (range.kind === "all-day") {
    if (edge === "start") {
      return compareCalendarDates(date, range.endDate) <= 0
        ? { ...range, startDate: date }
        : range
    }
    return compareCalendarDates(date, range.startDate) >= 0
      ? { ...range, endDate: date }
      : range
  }

  if (edge === "start") {
    const start = instantOnCalendarDate(range.start, date, timeZone)
    return start.getTime() < range.end.getTime() ? { ...range, start } : range
  }
  const end = instantOnCalendarDate(range.end, date, timeZone)
  return end.getTime() > range.start.getTime() ? { ...range, end } : range
}

export function createAllDayRange(
  first: CalendarDate,
  second: CalendarDate
): CalendarRange {
  return compareCalendarDates(first, second) <= 0
    ? { kind: "all-day", startDate: first, endDate: second }
    : { kind: "all-day", startDate: second, endDate: first }
}
