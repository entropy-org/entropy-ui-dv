import { describe, expect, it } from "vitest"
import type { CalendarItem } from "../types.js"
import {
  createAllDayItem,
  createTimedItem,
} from "../test/fixtures.js"
import { validateCalendarItems } from "./invariants.js"

describe("validateCalendarItems", () => {
  it("accepts valid all-day and timed items", () => {
    expect(
      validateCalendarItems([
        createAllDayItem({ id: "all-day" }),
        createTimedItem({ id: "timed" }),
      ])
    ).toEqual([])
  })

  it("reports duplicate and empty IDs", () => {
    const issues = validateCalendarItems([
      createAllDayItem({ id: "duplicate" }),
      createTimedItem({ id: "duplicate" }),
      createAllDayItem({ id: "" }),
    ])

    expect(issues.map((entry) => entry.reason)).toEqual([
      "duplicate-id",
      "empty-id",
    ])
  })

  it("reports malformed all-day boundaries without repairing them", () => {
    const item = createAllDayItem({
      id: "bad-date",
      startDate: "2026-02-30",
      endDate: "July 4",
    })

    expect(validateCalendarItems([item]).map((entry) => entry.reason)).toEqual([
      "invalid-start",
      "invalid-end",
    ])
    expect(item.startDate).toBe("2026-02-30")
    expect(item.endDate).toBe("July 4")
  })

  it("reports reversed all-day ranges", () => {
    const issues = validateCalendarItems([
      createAllDayItem({
        id: "reversed",
        startDate: "2026-07-28",
        endDate: "2026-07-27",
      }),
    ])

    expect(issues).toHaveLength(1)
    expect(issues[0].reason).toBe("reversed-range")
  })

  it("reports invalid, zero-duration, and reversed timed ranges", () => {
    const issues = validateCalendarItems([
      createTimedItem({
        id: "invalid",
        start: new Date("invalid"),
      }),
      createTimedItem({
        id: "invalid-end",
        end: new Date("invalid"),
      }),
      createTimedItem({
        id: "zero",
        start: new Date("2026-07-27T16:00:00Z"),
        end: new Date("2026-07-27T16:00:00Z"),
      }),
      createTimedItem({
        id: "reversed",
        start: new Date("2026-07-27T17:00:00Z"),
        end: new Date("2026-07-27T16:00:00Z"),
      }),
    ])

    expect(issues.map((entry) => entry.reason)).toEqual([
      "invalid-start",
      "invalid-end",
      "zero-duration",
      "reversed-range",
    ])
  })

  it("reports an unsupported runtime discriminant", () => {
    const item = {
      id: "bad-kind",
      kind: "milestone",
      data: null,
    } as unknown as CalendarItem

    expect(validateCalendarItems([item])[0].reason).toBe("invalid-kind")
  })

  it("requires stable recurrence occurrence identity and matching kinds", () => {
    const valid = createTimedItem({
      id: "series-1:2026-07-27T16:00:00Z",
      occurrence: {
        type: "timed",
        seriesId: "series-1",
        occurrenceId: "series-1:2026-07-27T16:00:00Z",
        originalStart: new Date("2026-07-27T16:00:00Z"),
        exception: "modified",
      },
    })
    const invalid = createAllDayItem({
      id: "wrong-id",
      occurrence: {
        type: "all-day",
        seriesId: "series-2",
        occurrenceId: "different-id",
        originalStartDate: "2026-07-27",
        exception: "generated",
      },
    })

    expect(validateCalendarItems([valid])).toEqual([])
    expect(validateCalendarItems([invalid])[0].reason).toBe(
      "invalid-occurrence"
    )
  })

  it("rejects empty source references", () => {
    expect(
      validateCalendarItems([
        createAllDayItem({ id: "event", calendarId: "" }),
      ])[0].reason
    ).toBe("invalid-source-id")
  })
})
