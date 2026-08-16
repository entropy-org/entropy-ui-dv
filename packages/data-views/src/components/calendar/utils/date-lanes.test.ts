import { describe, expect, it } from "vitest"
import {
  createAllDayItem,
  createTimedItem,
} from "../test/fixtures.js"
import {
  buildMonthGrid,
  buildWeekGrid,
} from "./date-grid.js"
import { layoutDateLanes } from "./date-lanes.js"
import { normalizeCalendarItems } from "./normalize-items.js"

function normalize(
  items: Parameters<typeof normalizeCalendarItems>[0],
  timeZone = "UTC"
) {
  return normalizeCalendarItems(items, { timeZone }).items
}

describe("date-column lane layout", () => {
  it("clips adjacent-month spans and splits multi-week continuations", () => {
    const grid = buildMonthGrid("2026-08-10", {
      weekStartsOn: 1,
      showWeekends: true,
    })
    const items = normalize([
      createAllDayItem({
        id: "long",
        startDate: "2026-07-25",
        endDate: "2026-08-12",
      }),
    ])
    const layout = layoutDateLanes(items, grid.rows, 4)

    expect(layout.placements).toHaveLength(3)
    expect(layout.placements[0]).toMatchObject({
      rowIndex: 0,
      segment: { startDate: "2026-07-27", endDate: "2026-08-02" },
      isRangeStart: false,
      continuedBefore: true,
      continuedAfter: true,
    })
    expect(layout.placements[2]).toMatchObject({
      rowIndex: 2,
      segment: { startDate: "2026-08-10", endDate: "2026-08-12" },
      isRangeEnd: true,
      continuedAfter: false,
    })
  })

  it("orders lanes by start, duration, kind, timed start, then id", () => {
    const grid = buildWeekGrid("2026-07-27", {
      weekStartsOn: 1,
      showWeekends: true,
    })
    const items = normalize([
      createTimedItem({
        id: "timed-late",
        start: new Date("2026-07-27T15:00:00Z"),
        end: new Date("2026-07-27T16:00:00Z"),
      }),
      createAllDayItem({
        id: "short",
        startDate: "2026-07-27",
        endDate: "2026-07-27",
      }),
      createAllDayItem({
        id: "long",
        startDate: "2026-07-27",
        endDate: "2026-07-29",
      }),
      createTimedItem({
        id: "timed-early",
        start: new Date("2026-07-27T08:00:00Z"),
        end: new Date("2026-07-27T09:00:00Z"),
      }),
    ])

    expect(
      layoutDateLanes(items, grid.rows, 10).placements.map(({ item, lane }) => [
        item.item.id,
        lane,
      ])
    ).toEqual([
      ["long", 0],
      ["short", 1],
      ["timed-early", 2],
      ["timed-late", 3],
    ])
  })

  it("reports deterministic overflow counts per date", () => {
    const grid = buildWeekGrid("2026-07-27", {
      weekStartsOn: 1,
      showWeekends: true,
    })
    const items = normalize(
      ["a", "b", "c"].map((id) =>
        createAllDayItem({
          id,
          startDate: "2026-07-27",
          endDate: "2026-07-28",
        })
      )
    )
    const layout = layoutDateLanes(items, grid.rows, 1)

    expect(layout.visiblePlacements.map(({ item }) => item.item.id)).toEqual([
      "a",
    ])
    expect(layout.overflowByDate).toEqual([
      { date: "2026-07-27", hiddenCount: 2 },
      { date: "2026-07-28", hiddenCount: 2 },
    ])
    expect(layout.laneCountByRow).toEqual([3])
  })

  it("lays out across hidden weekends without creating hidden columns", () => {
    const grid = buildWeekGrid("2026-07-27", {
      weekStartsOn: 1,
      showWeekends: false,
    })
    const items = normalize([
      createAllDayItem({
        id: "through-weekend",
        startDate: "2026-07-31",
        endDate: "2026-08-03",
      }),
      createAllDayItem({
        id: "weekend-only",
        startDate: "2026-08-01",
        endDate: "2026-08-02",
      }),
    ])
    const layout = layoutDateLanes(items, grid.rows, 4)

    expect(layout.placements).toHaveLength(1)
    expect(layout.placements[0]).toMatchObject({
      startColumn: 4,
      endColumn: 4,
      continuedAfter: true,
    })
  })

  it("does not mutate the normalized input order", () => {
    const grid = buildWeekGrid("2026-07-27", {
      weekStartsOn: 1,
      showWeekends: true,
    })
    const items = normalize([
      createAllDayItem({ id: "z" }),
      createAllDayItem({ id: "a" }),
    ])
    layoutDateLanes(items, grid.rows, 2)
    expect(items.map(({ item }) => item.id)).toEqual(["z", "a"])
  })
})
