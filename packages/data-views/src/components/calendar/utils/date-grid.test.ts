import { describe, expect, it } from "vitest"
import type { CalendarWeekStartsOn } from "../types.js"
import {
  buildMonthGrid,
  buildWeekGrid,
} from "./date-grid.js"

describe("calendar date grids", () => {
  it("models adjacent month cells in a six-week month", () => {
    const grid = buildMonthGrid("2026-08-12", {
      weekStartsOn: 1,
      showWeekends: true,
    })
    expect(grid.rowCount).toBe(6)
    expect(grid.cells).toHaveLength(42)
    expect(grid.cells[0]).toMatchObject({
      date: "2026-07-27",
      isCurrentMonth: false,
    })
    expect(grid.cells[41]).toMatchObject({
      date: "2026-09-06",
      isCurrentMonth: false,
    })
  })

  it("keeps five rows for a naturally four-week month", () => {
    expect(
      buildMonthGrid("2026-02-15", {
        weekStartsOn: 0,
        showWeekends: true,
      }).rows
    ).toHaveLength(5)
  })

  it("keeps hidden weekends in the model but removes their columns", () => {
    const grid = buildWeekGrid("2027-01-01", {
      weekStartsOn: 1,
      showWeekends: false,
    })
    expect(grid.cells).toHaveLength(7)
    expect(grid.rows[0].visibleCells.map(({ date }) => date)).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
    ])
    expect(grid.cells.slice(5).every(({ isVisible }) => !isVisible)).toBe(true)
  })

  it("places the configured first day in column zero for all week starts", () => {
    for (let value = 0; value < 7; value += 1) {
      const weekStartsOn = value as CalendarWeekStartsOn
      const grid = buildWeekGrid("2026-07-29", {
        weekStartsOn,
        showWeekends: true,
      })
      expect(grid.cells[0].dayOfWeek).toBe(weekStartsOn)
      expect(grid.cells[0].visibleColumnIndex).toBe(0)
    }
  })

  it("generates locale-aware labels from stable date-only values", () => {
    const english = buildWeekGrid("2026-07-27", {
      weekStartsOn: 1,
      showWeekends: true,
      locale: "en-US",
    })
    const french = buildWeekGrid("2026-07-27", {
      weekStartsOn: 1,
      showWeekends: true,
      locale: "fr-FR",
    })
    expect(english.cells[0]).toMatchObject({
      weekdayLabel: "Mon",
      dayLabel: "27",
    })
    expect(french.cells[0].weekdayLabel).toBe("lun.")
  })
})
