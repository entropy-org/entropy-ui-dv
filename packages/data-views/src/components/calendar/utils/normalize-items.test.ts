import { describe, expect, it } from "vitest"
import {
  createAllDayItem,
  createTimedItem,
} from "../test/fixtures.js"
import { getItemDateSpan } from "./date-range.js"
import { normalizeCalendarItems } from "./normalize-items.js"

describe("calendar item normalization", () => {
  it("keeps all-day date keys stable across time zones", () => {
    const item = createAllDayItem({
      id: "stable",
      startDate: "2026-03-08",
      endDate: "2026-03-09",
    })
    expect(getItemDateSpan(item, "America/Los_Angeles")).toEqual(
      getItemDateSpan(item, "Asia/Tokyo")
    )
  })

  it.each([
    [
      "spring forward",
      "America/Los_Angeles",
      "2026-03-08T09:30:00.000Z",
      "2026-03-08T10:30:00.000Z",
      "2026-03-08",
    ],
    [
      "fall back",
      "America/Los_Angeles",
      "2026-11-01T08:30:00.000Z",
      "2026-11-01T10:30:00.000Z",
      "2026-11-01",
    ],
    [
      "spring forward",
      "Europe/Berlin",
      "2026-03-29T00:30:00.000Z",
      "2026-03-29T02:30:00.000Z",
      "2026-03-29",
    ],
    [
      "fall back",
      "Europe/Berlin",
      "2026-10-25T00:30:00.000Z",
      "2026-10-25T02:30:00.000Z",
      "2026-10-25",
    ],
  ])(
    "assigns timed items on %s in %s",
    (_transition, timeZone, start, end, expectedDate) => {
      const item = createTimedItem({
        id: "dst",
        start: new Date(start),
        end: new Date(end),
      })
      expect(getItemDateSpan(item, timeZone)).toEqual({
        startDate: expectedDate,
        endDate: expectedDate,
      })
    }
  )

  it("honors half-open midnight ends", () => {
    const item = createTimedItem({
      id: "midnight",
      start: new Date("2026-07-27T23:00:00.000Z"),
      end: new Date("2026-07-28T00:00:00.000Z"),
    })
    expect(getItemDateSpan(item, "UTC")).toEqual({
      startDate: "2026-07-27",
      endDate: "2026-07-27",
    })
  })

  it("rejects malformed, reversed, zero, duplicate, and overlong items", () => {
    const valid = createAllDayItem({ id: "duplicate" })
    const result = normalizeCalendarItems(
      [
        valid,
        createAllDayItem({ id: "duplicate" }),
        createAllDayItem({
          id: "bad-date",
          startDate: "2026-02-30",
        }),
        createAllDayItem({
          id: "reversed",
          startDate: "2026-08-02",
          endDate: "2026-08-01",
        }),
        createTimedItem({
          id: "zero",
          start: new Date("2026-07-27T12:00:00Z"),
          end: new Date("2026-07-27T12:00:00Z"),
        }),
        createAllDayItem({
          id: "long",
          startDate: "2026-01-01",
          endDate: "2026-01-11",
        }),
      ],
      { timeZone: "UTC", maxSpanDays: 10 }
    )

    expect(result.items.map(({ item }) => item.id)).toEqual(["duplicate"])
    expect(result.invalidItems.map(({ reason }) => reason)).toEqual([
      "duplicate-id",
      "invalid-start",
      "reversed-range",
      "zero-duration",
      "span-too-long",
    ])
  })

  it("does not mutate input or reorder valid normalized items", () => {
    const items = [
      createTimedItem({ id: "later" }),
      createAllDayItem({ id: "first" }),
    ] as const
    const snapshot = [...items]
    const result = normalizeCalendarItems(items, { timeZone: "UTC" })
    expect(items).toEqual(snapshot)
    expect(result.items.map(({ item }) => item.id)).toEqual(["later", "first"])
  })
})
