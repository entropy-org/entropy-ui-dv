import type {
  AllDayCalendarItem,
  CalendarDate,
  CalendarDateSpan,
  CalendarItem,
  CalendarRange,
} from "../types.js"
import {
  addCalendarDays,
  compareCalendarDates,
  differenceInCalendarDays,
  getCalendarDateInTimeZone,
} from "./date-engine.js"

export function getCalendarItemRange(item: CalendarItem): CalendarRange {
  return item.kind === "all-day"
    ? {
        kind: "all-day",
        startDate: item.startDate,
        endDate: item.endDate,
      }
    : { kind: "timed", start: item.start, end: item.end }
}

export function getItemDateSpan(
  item: CalendarItem,
  timeZone: string
): CalendarDateSpan {
  if (item.kind === "all-day") {
    return { startDate: item.startDate, endDate: item.endDate }
  }
  return {
    startDate: getCalendarDateInTimeZone(item.start, timeZone),
    endDate: getCalendarDateInTimeZone(
      new Date(Math.max(item.start.getTime(), item.end.getTime() - 1)),
      timeZone
    ),
  }
}

export function getInclusiveDateSpanDays(span: CalendarDateSpan): number {
  return differenceInCalendarDays(span.endDate, span.startDate) + 1
}

export function isDateWithinSpan(
  date: CalendarDate,
  span: CalendarDateSpan
): boolean {
  return (
    compareCalendarDates(date, span.startDate) >= 0 &&
    compareCalendarDates(date, span.endDate) <= 0
  )
}

export function dateSpansIntersect(
  first: CalendarDateSpan,
  second: CalendarDateSpan
): boolean {
  return (
    compareCalendarDates(first.startDate, second.endDate) <= 0 &&
    compareCalendarDates(second.startDate, first.endDate) <= 0
  )
}

export function clipDateSpan(
  span: CalendarDateSpan,
  boundary: CalendarDateSpan
): CalendarDateSpan | null {
  if (!dateSpansIntersect(span, boundary)) return null
  return {
    startDate:
      compareCalendarDates(span.startDate, boundary.startDate) < 0
        ? boundary.startDate
        : span.startDate,
    endDate:
      compareCalendarDates(span.endDate, boundary.endDate) > 0
        ? boundary.endDate
        : span.endDate,
  }
}

export function shiftAllDayRange(
  range: Pick<AllDayCalendarItem, "startDate" | "endDate">,
  days: number
): CalendarDateSpan {
  return {
    startDate: addCalendarDays(range.startDate, days),
    endDate: addCalendarDays(range.endDate, days),
  }
}

export function calendarRangesEqual(
  first: CalendarRange,
  second: CalendarRange
): boolean {
  if (first.kind !== second.kind) return false
  if (first.kind === "all-day" && second.kind === "all-day") {
    return (
      first.startDate === second.startDate && first.endDate === second.endDate
    )
  }
  return (
    first.kind === "timed" &&
    second.kind === "timed" &&
    first.start.getTime() === second.start.getTime() &&
    first.end.getTime() === second.end.getTime()
  )
}
