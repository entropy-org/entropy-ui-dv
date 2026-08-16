/** Date-boundary snapping used by timeline interactions. */
import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  roundToNearestMinutes,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
} from "date-fns"
import type { ViewportMode } from "../types.js"
import { VIEWPORT_MODE_CONFIGS } from "../constants.js"

type SnapUnit = "15min" | "day" | "week" | "month" | "quarter"

/** Hours snap to quarter hours; every broader mode snaps to calendar days. */
export function getSnapUnit(mode: ViewportMode): SnapUnit {
  return VIEWPORT_MODE_CONFIGS[mode].snapUnit
}

/** Snap a date to the configured boundary for the current zoom level. */
export function snapToGrid(date: Date, mode: ViewportMode): Date {
  const snapUnit = getSnapUnit(mode)
  return snapToUnit(date, snapUnit)
}

/** Snap a date to the nearest boundary of an explicit unit. */
export function snapToUnit(date: Date, unit: SnapUnit): Date {
  switch (unit) {
    case "15min":
      return roundToNearestMinutes(date, { nearestTo: 15 })

    case "day":
      return snapToNearest(date, startOfDay, (d) => addDays(d, 1))

    case "week":
      return snapToNearest(
        date,
        (d) => startOfWeek(d, { weekStartsOn: 1 }),
        (d) => addWeeks(d, 1)
      )

    case "month":
      return snapToNearest(date, startOfMonth, (d) => addMonths(d, 1))

    case "quarter":
      return snapToNearest(date, startOfQuarter, (d) => addQuarters(d, 1))
  }
}

/** Select the closer of the current and next unit boundaries. */
function snapToNearest(
  date: Date,
  getStart: (d: Date) => Date,
  getNext: (d: Date) => Date
): Date {
  const start = getStart(date)
  const next = getNext(start)
  const diffToStart = Math.abs(date.getTime() - start.getTime())
  const diffToNext = Math.abs(next.getTime() - date.getTime())
  return diffToStart <= diffToNext ? start : next
}
