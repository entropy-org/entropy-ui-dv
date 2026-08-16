import { describe, expect, it } from "vitest"
import type { ViewportMode } from "../types.js"
import {
  addOneColumnUnit,
  alignToColumnStart,
  countColumns,
  generateColumnDates,
  getPrimaryHeaderLabel,
  getSecondaryHeaderLabel,
} from "./date-utils.js"

const DAY_MODES: ViewportMode[] = [
  "day",
  "week",
  "bi-week",
  "month",
  "quarter",
  "year",
]

describe("alignToColumnStart", () => {
  const midJuly = new Date("2026-07-14T14:30:00")

  it("aligns the hour view to the previous quarter hour", () => {
    const result = alignToColumnStart(new Date("2026-07-14T14:38:42"), "hours")
    expect(result.getHours()).toBe(14)
    expect(result.getMinutes()).toBe(30)
    expect(result.getSeconds()).toBe(0)
  })

  it.each(DAY_MODES)("aligns %s mode to the start of the day", (mode) => {
    const result = alignToColumnStart(midJuly, mode)
    expect(result.getDate()).toBe(14)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
  })
})

describe("addOneColumnUnit", () => {
  const base = new Date("2026-07-14T00:00:00")

  it("adds fifteen minutes in hours mode", () => {
    expect(addOneColumnUnit(base, "hours").getMinutes()).toBe(15)
  })

  it.each(DAY_MODES)("adds one calendar day in %s mode", (mode) => {
    expect(addOneColumnUnit(base, mode).getDate()).toBe(15)
  })
})

describe("countColumns", () => {
  it("counts quarter-hour columns in hours mode", () => {
    const start = new Date("2026-07-14T00:00:00")
    const end = new Date("2026-07-14T05:00:00")
    expect(countColumns(start, end, "hours")).toBe(20)
  })

  it.each(DAY_MODES)("counts calendar days in %s mode", (mode) => {
    const start = new Date("2026-07-14T00:00:00")
    const end = new Date("2026-07-21T00:00:00")
    expect(countColumns(start, end, mode)).toBe(7)
  })
})

describe("header labels", () => {
  const date = new Date("2026-07-14T14:00:00")

  it("uses full hour and half-hour labels in hours mode", () => {
    expect(getPrimaryHeaderLabel(date, "hours")).toBe("Tue Jul 14")
    expect(getSecondaryHeaderLabel(date, "hours")).toBe("2pm")
    expect(
      getSecondaryHeaderLabel(new Date("2026-07-14T14:30:00"), "hours")
    ).toBe("2:30pm")
  })

  it.each(DAY_MODES)("uses month and day labels in %s mode", (mode) => {
    expect(getPrimaryHeaderLabel(date, mode)).toBe(
      mode === "year" ? "Jul 2026" : "July 2026"
    )
    expect(getSecondaryHeaderLabel(date, mode)).toBe("14")
  })
})

describe("generateColumnDates", () => {
  it("generates quarter-hour columns in hours mode", () => {
    const dates = generateColumnDates(
      new Date("2026-07-14T10:00:00"),
      new Date("2026-07-14T11:00:00"),
      "hours"
    )

    expect(dates.map((date) => date.getMinutes())).toEqual([0, 15, 30, 45])
  })

  it.each(DAY_MODES)("generates one date per day in %s mode", (mode) => {
    const start = new Date("2026-07-14T00:00:00")
    const end = new Date("2026-07-18T00:00:00")
    const dates = generateColumnDates(start, end, mode)

    expect(dates).toHaveLength(4)
    expect(dates.map((date) => date.getDate())).toEqual([14, 15, 16, 17])
  })

  it("returns an empty array when start is not before end", () => {
    const date = new Date("2026-07-14T00:00:00")
    expect(generateColumnDates(date, date, "day")).toEqual([])
  })
})
