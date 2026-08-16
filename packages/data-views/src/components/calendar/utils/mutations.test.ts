import { describe, expect, it } from "vitest"
import {
  createAllDayRange,
  resizeCalendarRangeToDate,
  shiftCalendarRangeByDays,
} from "./mutations.js"

describe("calendar mutation range utilities", () => {
  it("shifts all-day ranges and normalizes created range direction", () => {
    expect(
      shiftCalendarRangeByDays(
        {
          kind: "all-day",
          startDate: "2026-12-31",
          endDate: "2027-01-02",
        },
        1,
        "UTC"
      )
    ).toEqual({
      kind: "all-day",
      startDate: "2027-01-01",
      endDate: "2027-01-03",
    })
    expect(createAllDayRange("2026-07-30", "2026-07-27")).toEqual({
      kind: "all-day",
      startDate: "2026-07-27",
      endDate: "2026-07-30",
    })
  })

  it("preserves timed local start and elapsed duration across DST", () => {
    const range = {
      kind: "timed" as const,
      start: new Date("2026-03-07T17:00:00.000Z"),
      end: new Date("2026-03-07T18:30:00.000Z"),
    }
    const shifted = shiftCalendarRangeByDays(range, 1, "America/Los_Angeles")
    expect(shifted.kind).toBe("timed")
    if (shifted.kind !== "timed") return
    expect(shifted.start.toISOString()).toBe("2026-03-08T16:00:00.000Z")
    expect(shifted.end.getTime() - shifted.start.getTime()).toBe(5_400_000)
  })

  it("resizes both range kinds without allowing edges to cross", () => {
    const allDay = {
      kind: "all-day" as const,
      startDate: "2026-07-27",
      endDate: "2026-07-30",
    }
    expect(
      resizeCalendarRangeToDate(allDay, "start", "2026-07-28", "UTC")
    ).toEqual({ ...allDay, startDate: "2026-07-28" })
    expect(
      resizeCalendarRangeToDate(allDay, "start", "2026-08-01", "UTC")
    ).toBe(allDay)
    expect(
      resizeCalendarRangeToDate(allDay, "end", "2026-08-01", "UTC")
    ).toEqual({ ...allDay, endDate: "2026-08-01" })
    expect(resizeCalendarRangeToDate(allDay, "end", "2026-07-20", "UTC")).toBe(
      allDay
    )

    const timed = {
      kind: "timed" as const,
      start: new Date("2026-07-27T16:00:00.000Z"),
      end: new Date("2026-07-29T17:00:00.000Z"),
    }
    const resized = resizeCalendarRangeToDate(timed, "end", "2026-07-30", "UTC")
    expect(resized.kind === "timed" && resized.end.toISOString()).toBe(
      "2026-07-30T17:00:00.000Z"
    )
    const resizedStart = resizeCalendarRangeToDate(
      timed,
      "start",
      "2026-07-28",
      "UTC"
    )
    expect(
      resizedStart.kind === "timed" && resizedStart.start.toISOString()
    ).toBe("2026-07-28T16:00:00.000Z")
    expect(resizeCalendarRangeToDate(timed, "start", "2026-07-30", "UTC")).toBe(
      timed
    )
    expect(resizeCalendarRangeToDate(timed, "end", "2026-07-26", "UTC")).toBe(
      timed
    )
  })
})
