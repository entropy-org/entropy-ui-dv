import { describe, expect, it } from "vitest"
import type { CalendarWeekStartsOn } from "../types.js"
import {
  addCalendarDays,
  calendarDateToEpochDay,
  differenceInCalendarDays,
  endOfMonth,
  getCalendarDateInTimeZone,
  getVisibleDateRange,
  isCalendarDate,
  startOfWeek,
} from "./date-engine.js"

describe("calendar date engine", () => {
  it("strictly validates canonical dates including leap years", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true)
    expect(isCalendarDate("2025-02-29")).toBe(false)
    expect(isCalendarDate("2026-7-27")).toBe(false)
    expect(isCalendarDate("2026-13-01")).toBe(false)
    expect(isCalendarDate(undefined)).toBe(false)
  })

  it("does DST-independent date arithmetic across year boundaries", () => {
    expect(addCalendarDays("2024-02-28", 1)).toBe("2024-02-29")
    expect(addCalendarDays("2024-02-29", 1)).toBe("2024-03-01")
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(differenceInCalendarDays("2027-01-01", "2026-12-31")).toBe(1)
    expect(calendarDateToEpochDay("1970-01-01")).toBe(0)
    expect(endOfMonth("2024-02-09")).toBe("2024-02-29")
  })

  it("supports every configured week start", () => {
    for (let value = 0; value < 7; value += 1) {
      const weekStartsOn = value as CalendarWeekStartsOn
      const start = startOfWeek("2026-07-29", weekStartsOn)
      expect(differenceInCalendarDays("2026-07-29", start)).toBe(
        (3 - weekStartsOn + 7) % 7
      )
    }
  })

  it("creates five- and six-row month ranges and never a four-row month", () => {
    expect(getVisibleDateRange("2026-02-10", "month", 0)).toEqual({
      startDate: "2026-02-01",
      endDate: "2026-03-07",
      rowCount: 5,
      dayCount: 35,
    })
    expect(getVisibleDateRange("2026-08-10", "month", 1)).toMatchObject({
      startDate: "2026-07-27",
      endDate: "2026-09-06",
      rowCount: 6,
      dayCount: 42,
    })
  })

  it("builds a seven-day week across month and year boundaries", () => {
    expect(getVisibleDateRange("2027-01-01", "week", 1)).toEqual({
      startDate: "2026-12-28",
      endDate: "2027-01-03",
      rowCount: 1,
      dayCount: 7,
    })
  })

  it("maps instants into configured IANA time zones", () => {
    const instant = new Date("2026-07-27T01:00:00.000Z")
    expect(getCalendarDateInTimeZone(instant, "UTC")).toBe("2026-07-27")
    expect(getCalendarDateInTimeZone(instant, "America/Los_Angeles")).toBe(
      "2026-07-26"
    )
    expect(() =>
      getCalendarDateInTimeZone(new Date(Number.NaN), "UTC")
    ).toThrow("invalid instant")
  })
})
