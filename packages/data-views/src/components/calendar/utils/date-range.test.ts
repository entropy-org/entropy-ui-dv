import { describe, expect, it } from "vitest"
import {
  createAllDayItem,
  createTimedItem,
} from "../test/fixtures.js"
import {
  calendarRangesEqual,
  clipDateSpan,
  dateSpansIntersect,
  getCalendarItemRange,
  getInclusiveDateSpanDays,
  shiftAllDayRange,
} from "./date-range.js"

describe("calendar date ranges", () => {
  it("clips inclusive spans and detects disjoint spans", () => {
    expect(
      clipDateSpan(
        { startDate: "2026-07-25", endDate: "2026-08-02" },
        { startDate: "2026-07-27", endDate: "2026-07-31" }
      )
    ).toEqual({ startDate: "2026-07-27", endDate: "2026-07-31" })
    expect(
      dateSpansIntersect(
        { startDate: "2026-07-01", endDate: "2026-07-02" },
        { startDate: "2026-07-03", endDate: "2026-07-04" }
      )
    ).toBe(false)
    expect(
      clipDateSpan(
        { startDate: "2026-07-01", endDate: "2026-07-02" },
        { startDate: "2026-07-03", endDate: "2026-07-04" }
      )
    ).toBeNull()
  })

  it("counts and shifts inclusive all-day spans", () => {
    expect(
      getInclusiveDateSpanDays({
        startDate: "2026-12-31",
        endDate: "2027-01-02",
      })
    ).toBe(3)
    expect(
      shiftAllDayRange({ startDate: "2026-12-31", endDate: "2027-01-02" }, 1)
    ).toEqual({ startDate: "2027-01-01", endDate: "2027-01-03" })
  })

  it("extracts and compares both range kinds", () => {
    const allDay = createAllDayItem({ id: "all" })
    const timed = createTimedItem({ id: "timed" })
    expect(
      calendarRangesEqual(
        getCalendarItemRange(allDay),
        getCalendarItemRange(allDay)
      )
    ).toBe(true)
    expect(
      calendarRangesEqual(
        getCalendarItemRange(timed),
        getCalendarItemRange(timed)
      )
    ).toBe(true)
    expect(
      calendarRangesEqual(
        getCalendarItemRange(allDay),
        getCalendarItemRange(timed)
      )
    ).toBe(false)
  })
})
