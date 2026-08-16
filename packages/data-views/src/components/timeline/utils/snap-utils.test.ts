/**
 * Tests for snap-to-grid utilities.
 */
import { describe, expect, it } from "vitest"
import {
  getSnapUnit,
  snapToGrid,
  snapToUnit,
} from "./snap-utils.js"
import type { ViewportMode } from "../types.js"

describe("getSnapUnit", () => {
  it("uses quarter-hour snapping in hours mode", () => {
    expect(getSnapUnit("hours")).toBe("15min")
  })

  it.each<ViewportMode>(["day", "week", "bi-week", "month", "quarter", "year"])(
    "returns a day snap unit for %s mode",
    (mode) => {
      expect(getSnapUnit(mode)).toBe("day")
    }
  )
})

describe("snapToUnit — 15min", () => {
  it("snaps to nearest 15-minute boundary (round down)", () => {
    const date = new Date("2026-07-14T14:07:00")
    const snapped = snapToUnit(date, "15min")
    expect(snapped.getHours()).toBe(14)
    expect(snapped.getMinutes()).toBe(0)
  })

  it("snaps to nearest 15-minute boundary (round up)", () => {
    const date = new Date("2026-07-14T14:08:00")
    const snapped = snapToUnit(date, "15min")
    expect(snapped.getHours()).toBe(14)
    expect(snapped.getMinutes()).toBe(15)
  })

  it("keeps exact 15-minute marks unchanged", () => {
    const date = new Date("2026-07-14T14:30:00")
    const snapped = snapToUnit(date, "15min")
    expect(snapped.getHours()).toBe(14)
    expect(snapped.getMinutes()).toBe(30)
  })
})

describe("snapToUnit — day", () => {
  it("snaps to start of current day (before noon)", () => {
    const date = new Date("2026-07-14T10:00:00")
    const snapped = snapToUnit(date, "day")
    expect(snapped.getDate()).toBe(14)
    expect(snapped.getHours()).toBe(0)
  })

  it("snaps to start of next day (after noon)", () => {
    const date = new Date("2026-07-14T14:00:00")
    const snapped = snapToUnit(date, "day")
    expect(snapped.getDate()).toBe(15)
    expect(snapped.getHours()).toBe(0)
  })
})

describe("snapToUnit — week", () => {
  it("snaps to start of nearest Monday", () => {
    // July 14 2026 is a Tuesday → closer to Monday July 13
    const date = new Date("2026-07-14T06:00:00")
    const snapped = snapToUnit(date, "week")
    expect(snapped.getDay()).toBe(1) // Monday
    expect(snapped.getDate()).toBe(13)
  })

  it("snaps to start of nearest Monday (end of week)", () => {
    // July 18 2026 is a Sat → closer to Monday July 20
    const date = new Date("2026-07-18T06:00:00")
    const snapped = snapToUnit(date, "week")
    expect(snapped.getDay()).toBe(1) // Monday
    expect(snapped.getDate()).toBe(20)
  })
})

describe("snapToUnit — month", () => {
  it("snaps to start of current month (early in month)", () => {
    const date = new Date("2026-07-05")
    const snapped = snapToUnit(date, "month")
    expect(snapped.getDate()).toBe(1)
    expect(snapped.getMonth()).toBe(6) // July
  })

  it("snaps to start of next month (late in month)", () => {
    const date = new Date("2026-07-25")
    const snapped = snapToUnit(date, "month")
    expect(snapped.getDate()).toBe(1)
    expect(snapped.getMonth()).toBe(7) // August
  })
})

describe("snapToUnit — quarter", () => {
  it("snaps to start of current quarter (early)", () => {
    const date = new Date("2026-07-15")
    const snapped = snapToUnit(date, "quarter")
    expect(snapped.getDate()).toBe(1)
    expect(snapped.getMonth()).toBe(6) // July = Q3 start
  })

  it("snaps to start of next quarter (late)", () => {
    const date = new Date("2026-08-20")
    const snapped = snapToUnit(date, "quarter")
    expect(snapped.getDate()).toBe(1)
    expect(snapped.getMonth()).toBe(9) // October = Q4 start
  })
})

describe("snapToGrid", () => {
  it("snaps hours mode to the nearest quarter hour", () => {
    const snapped = snapToGrid(new Date("2026-07-14T10:23:00"), "hours")
    expect(snapped.getHours()).toBe(10)
    expect(snapped.getMinutes()).toBe(30)
  })

  it.each<ViewportMode>(["day", "week", "bi-week", "month", "quarter", "year"])(
    "snaps %s mode to a calendar-day boundary",
    (mode) => {
      const date = new Date("2026-07-14T10:00:00")
      const snapped = snapToGrid(date, mode)
      expect(snapped.getDate()).toBe(14)
      expect(snapped.getHours()).toBe(0)
      expect(snapped.getMinutes()).toBe(0)
    }
  )
})
