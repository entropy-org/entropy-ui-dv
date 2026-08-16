import {
  addDays,
  differenceInCalendarDays,
  differenceInMilliseconds,
  startOfDay,
} from "date-fns"
import type { ViewportMode } from "../types.js"
import { getColumnWidth } from "./viewport-config.js"

const QUARTER_HOUR_MS = 15 * 60 * 1000

function fractionOfCalendarDay(date: Date): number {
  const dayStart = startOfDay(date)
  const nextDay = addDays(dayStart, 1)
  return (
    (date.getTime() - dayStart.getTime()) /
    (nextDay.getTime() - dayStart.getTime())
  )
}

function differenceInTimelineDays(date: Date, origin: Date): number {
  return (
    differenceInCalendarDays(startOfDay(date), startOfDay(origin)) +
    fractionOfCalendarDay(date) -
    fractionOfCalendarDay(origin)
  )
}

export function dateToPx(date: Date, origin: Date, mode: ViewportMode): number {
  const columnWidth = getColumnWidth(mode)

  if (mode === "hours") {
    return (
      (differenceInMilliseconds(date, origin) / QUARTER_HOUR_MS) * columnWidth
    )
  }

  return differenceInTimelineDays(date, origin) * columnWidth
}

export function dateRangeToPxWidth(
  startDate: Date,
  endDate: Date,
  mode: ViewportMode
): number {
  return dateToPx(endDate, startDate, mode)
}

export function pxToDate(px: number, origin: Date, mode: ViewportMode): Date {
  const columnWidth = getColumnWidth(mode)

  if (mode === "hours") {
    return new Date(origin.getTime() + (px / columnWidth) * QUARTER_HOUR_MS)
  }

  const dayCoordinate = fractionOfCalendarDay(origin) + px / columnWidth
  const wholeDays = Math.floor(dayCoordinate)
  const dayFraction = dayCoordinate - wholeDays
  const dayStart = addDays(startOfDay(origin), wholeDays)
  const nextDay = addDays(dayStart, 1)

  return new Date(
    dayStart.getTime() + dayFraction * (nextDay.getTime() - dayStart.getTime())
  )
}

export interface BarPosition {
  left: number
  width: number
}

export function getBarPosition(
  startDate: Date,
  endDate: Date,
  origin: Date,
  mode: ViewportMode
): BarPosition {
  return {
    left: dateToPx(startDate, origin, mode),
    width: dateRangeToPxWidth(startDate, endDate, mode),
  }
}
