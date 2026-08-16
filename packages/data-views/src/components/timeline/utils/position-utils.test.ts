import { describe, expect, it } from "vitest"
import type { ViewportMode } from "../types.js"
import {
  dateRangeToPxWidth,
  dateToPx,
  getBarPosition,
  pxToDate,
} from "./position-utils.js"
import { getColumnWidth } from "./viewport-config.js"

const origin = new Date("2026-07-14T00:00:00")
const ALL_MODES: ViewportMode[] = [
  "hours",
  "day",
  "week",
  "bi-week",
  "month",
  "quarter",
  "year",
]

describe("date and pixel conversion", () => {
  it("maps one day to the configured density in every day-based mode", () => {
    const nextDay = new Date("2026-07-15T00:00:00")

    for (const mode of ALL_MODES.filter((mode) => mode !== "hours")) {
      expect(dateToPx(nextDay, origin, mode)).toBeCloseTo(
        getColumnWidth(mode),
        5
      )
    }
  })

  it("maps quarter hours and fractional calendar days", () => {
    expect(
      dateToPx(new Date("2026-07-14T03:00:00"), origin, "hours")
    ).toBeCloseTo(12 * getColumnWidth("hours"), 5)
    expect(
      dateToPx(new Date("2026-07-14T12:00:00"), origin, "day")
    ).toBeCloseTo(120, 5)
  })

  it("supports dates before the origin", () => {
    expect(
      dateToPx(new Date("2026-07-13T00:00:00"), origin, "day")
    ).toBeCloseTo(-240, 5)
  })

  it.each(ALL_MODES)("round-trips dates in %s mode", (mode) => {
    const date = new Date("2026-07-17T06:00:00")
    const roundTripped = pxToDate(dateToPx(date, origin, mode), origin, mode)

    expect(Math.abs(roundTripped.getTime() - date.getTime())).toBeLessThan(1000)
  })

  it("keeps calendar-day width stable across daylight-saving changes", () => {
    const beforeChange = new Date("2026-03-07T00:00:00")
    const afterChange = new Date("2026-03-09T00:00:00")

    expect(dateToPx(afterChange, beforeChange, "month")).toBeCloseTo(
      2 * getColumnWidth("month"),
      5
    )
    expect(
      pxToDate(2 * getColumnWidth("month"), beforeChange, "month").getTime()
    ).toBe(afterChange.getTime())
  })
})

describe("bar positioning", () => {
  it("computes exact day-based range widths", () => {
    const start = new Date("2026-07-14T00:00:00")
    const end = new Date("2026-07-21T00:00:00")
    expect(dateRangeToPxWidth(start, end, "day")).toBeCloseTo(1680, 5)
  })

  it("computes quarter-hour-based range widths", () => {
    const start = new Date("2026-07-14T10:00:00")
    const end = new Date("2026-07-14T13:00:00")
    expect(dateRangeToPxWidth(start, end, "hours")).toBeCloseTo(
      12 * getColumnWidth("hours"),
      5
    )
  })

  it("returns a bar's left offset and width", () => {
    const position = getBarPosition(
      new Date("2026-07-15T00:00:00"),
      new Date("2026-07-18T00:00:00"),
      origin,
      "day"
    )

    expect(position.left).toBeCloseTo(240, 5)
    expect(position.width).toBeCloseTo(720, 5)
  })
})
