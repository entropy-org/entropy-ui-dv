import { describe, expect, it } from "vitest"
import type { ViewportMode } from "../types.js"
import {
  getColumnWidth,
  getDayWidth,
  getViewportConfig,
  isCoarsestMode,
  isFinestMode,
  shouldRenderColumnGuide,
  shouldRenderHeaderLabel,
  zoomIn,
  zoomOut,
} from "./viewport-config.js"

const ALL_MODES: ViewportMode[] = [
  "hours",
  "day",
  "week",
  "bi-week",
  "month",
  "quarter",
  "year",
]

describe("viewport configuration", () => {
  it.each(ALL_MODES)("provides a valid config for %s", (mode) => {
    const config = getViewportConfig(mode)
    expect(config.mode).toBe(mode)
    expect(config.columnWidthPx).toBeGreaterThan(0)
    expect(config.snapUnit).toBe(mode === "hours" ? "15min" : "day")
  })

  it("uses quarter-hour columns followed by progressively denser day scales", () => {
    expect(getColumnWidth("hours")).toBe(40)
    expect(getColumnWidth("day")).toBe(240)
    expect(getColumnWidth("week")).toBe(120)
    expect(getColumnWidth("bi-week")).toBe(60)
    expect(getColumnWidth("month")).toBe(48)
    expect(getColumnWidth("quarter")).toBe(11)
    expect(getColumnWidth("year")).toBe(6)

    for (const mode of ALL_MODES.filter((mode) => mode !== "hours")) {
      expect(getViewportConfig(mode).columnUnit).toBe("day")
      expect(getDayWidth(mode)).toBe(getColumnWidth(mode))
    }
    expect(getViewportConfig("hours").columnUnit).toBe("quarter-hour")
    expect(getDayWidth("hours")).toBe(3840)
  })

  it("keeps year view farther out than quarter scale", () => {
    const visibleDays = 980 / getColumnWidth("year")
    const visibleMonths = visibleDays / (365 / 12)

    expect(visibleMonths).toBeGreaterThanOrEqual(5)
    expect(visibleMonths).toBeLessThanOrEqual(6)
    expect(getColumnWidth("year")).toBeLessThan(getColumnWidth("quarter"))
  })

  it("shows four sampled days per month at quarter and year scales", () => {
    const julyDays = [1, 8, 9, 15, 17, 22, 25, 29].map(
      (day) => new Date(2026, 6, day)
    )

    expect(
      julyDays
        .filter((date) => shouldRenderHeaderLabel(date, "quarter"))
        .map((date) => date.getDate())
    ).toEqual([1, 9, 17, 25])
    expect(
      julyDays
        .filter((date) => shouldRenderHeaderLabel(date, "year"))
        .map((date) => date.getDate())
    ).toEqual([1, 9, 17, 25])
  })

  it("keeps grid guides only where each mode needs visual structure", () => {
    const firstOfMonth = new Date(2026, 6, 1)
    const middleOfMonth = new Date(2026, 6, 15)

    expect(shouldRenderColumnGuide(firstOfMonth, "month")).toBe(false)
    expect(shouldRenderColumnGuide(firstOfMonth, "quarter")).toBe(true)
    expect(shouldRenderColumnGuide(middleOfMonth, "quarter")).toBe(false)
    expect(shouldRenderColumnGuide(firstOfMonth, "year")).toBe(true)
    expect(shouldRenderColumnGuide(middleOfMonth, "year")).toBe(false)
  })

  it("shows and guides every thirty minutes while keeping quarter-hour columns", () => {
    const atHour = new Date(2026, 6, 1, 10)
    const atQuarter = new Date(2026, 6, 1, 10, 15)
    const atHalfHour = new Date(2026, 6, 1, 10, 30)

    expect(shouldRenderHeaderLabel(atHour, "hours")).toBe(true)
    expect(shouldRenderHeaderLabel(atQuarter, "hours")).toBe(false)
    expect(shouldRenderHeaderLabel(atHalfHour, "hours")).toBe(true)
    expect(shouldRenderColumnGuide(atQuarter, "hours")).toBe(false)
    expect(shouldRenderColumnGuide(atHalfHour, "hours")).toBe(true)
  })
})

describe("zoom navigation", () => {
  it("zooms between adjacent modes and clamps at both ends", () => {
    expect(zoomIn("week")).toBe("day")
    expect(zoomIn("year")).toBe("quarter")
    expect(zoomIn("hours")).toBe("hours")
    expect(zoomOut("week")).toBe("bi-week")
    expect(zoomOut("hours")).toBe("day")
    expect(zoomOut("year")).toBe("year")
  })

  it("identifies the finest and coarsest modes", () => {
    expect(isFinestMode("hours")).toBe(true)
    expect(isFinestMode("day")).toBe(false)
    expect(isCoarsestMode("year")).toBe(true)
    expect(isCoarsestMode("quarter")).toBe(false)
  })
})
