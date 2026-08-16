import { describe, expect, it } from "vitest"
import {
  agendaWallClockToInstant,
  getAdjacentAgendaAnchor,
  getAgendaVisibleSpan,
  getAgendaHourHeight,
  getWallClockMinutes,
  layoutAgendaAllDaySegments,
  layoutAgendaTimedSegments,
  snapAgendaMinutes,
  shiftTimedRangeByWallClock,
} from "./agenda.js"
import { getCalendarDateInTimeZone } from "./date-engine.js"
import { createAllDayItem, createTimedItem } from "../test/fixtures.js"

describe("calendar agenda pure model", () => {
  it("builds day, aligned week, and visible-column custom spans", () => {
    expect(getAgendaVisibleSpan("2026-08-08", { type: "day" }, 1, false).dates).toEqual(["2026-08-10"])
    expect(getAgendaVisibleSpan("2026-08-05", { type: "week" }, 1, false).dates).toEqual([
      "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07",
    ])
    expect(getAgendaVisibleSpan("2026-08-07", { type: "custom", dayCount: 3 }, 1, false).dates).toEqual([
      "2026-08-07", "2026-08-10", "2026-08-11",
    ])
  })

  it("navigates custom spans by rendered days and skips hidden weekends", () => {
    expect(getAdjacentAgendaAnchor("2026-08-07", { type: "custom", dayCount: 3 }, 1, false, "next")).toBe("2026-08-12")
    expect(getAdjacentAgendaAnchor("2026-08-10", { type: "day" }, 1, false, "previous")).toBe("2026-08-07")
    expect(getAdjacentAgendaAnchor("2026-08-05", { type: "week" }, 1, false, "previous")).toBe("2026-07-27")
    expect(getAdjacentAgendaAnchor("2026-08-05", { type: "week" }, 1, true, "next")).toBe("2026-08-10")
    expect(snapAgendaMinutes(-50, 15)).toBe(0)
    expect(snapAgendaMinutes(1500, 15)).toBe(1440)
    const basePreferences = {
      span: { type: "week" as const },
      snapMinutes: 15 as const,
      workingHours: { startMinutes: 540, endMinutes: 1020 },
      initialScrollMinutes: 360,
      showAllDaySection: true,
    }
    expect(getAgendaHourHeight({ ...basePreferences, hourHeight: 16 })).toBe(32)
    expect(getAgendaHourHeight({ ...basePreferences, hourHeight: 300 })).toBe(240)
  })

  it("resolves normal, spring-gap, and fall-fold wall-clock values", () => {
    const normal = agendaWallClockToInstant("2026-07-27", 9 * 60 + 15, "America/Los_Angeles")
    expect(getCalendarDateInTimeZone(normal, "America/Los_Angeles")).toBe("2026-07-27")
    expect(getWallClockMinutes(normal, "America/Los_Angeles")).toBe(555)

    const gap = agendaWallClockToInstant("2026-03-08", 2 * 60 + 30, "America/Los_Angeles")
    expect(getWallClockMinutes(gap, "America/Los_Angeles")).toBeGreaterThanOrEqual(180)

    const fold = agendaWallClockToInstant("2026-11-01", 90, "America/Los_Angeles")
    expect(getWallClockMinutes(fold, "America/Los_Angeles")).toBe(90)
  })

  it("preserves duration and wall-clock start across a DST day move", () => {
    const start = agendaWallClockToInstant("2026-03-07", 9 * 60, "America/Los_Angeles")
    const range = { kind: "timed" as const, start, end: new Date(start.getTime() + 60 * 60_000) }
    const shifted = shiftTimedRangeByWallClock(range, 1, 0, "America/Los_Angeles")
    expect(shifted.kind).toBe("timed")
    if (shifted.kind === "timed") {
      expect(getCalendarDateInTimeZone(shifted.start, "America/Los_Angeles")).toBe("2026-03-08")
      expect(getWallClockMinutes(shifted.start, "America/Los_Angeles")).toBe(540)
      expect(shifted.end.getTime() - shifted.start.getTime()).toBe(60 * 60_000)
    }
  })

  it("splits cross-midnight items and assigns overlap columns with abutting reuse", () => {
    const items = [
      createTimedItem({ id: "base" }),
      createTimedItem({ id: "cross", start: new Date("2026-07-28T06:30:00Z"), end: new Date("2026-07-28T08:30:00Z") }),
      createTimedItem({ id: "overlap", start: new Date("2026-07-27T16:30:00Z"), end: new Date("2026-07-27T17:30:00Z") }),
      createTimedItem({ id: "abut", start: new Date("2026-07-27T17:30:00Z"), end: new Date("2026-07-27T18:00:00Z") }),
    ]
    const segments = layoutAgendaTimedSegments(items, ["2026-07-27", "2026-07-28"], "America/Los_Angeles")
    expect(segments.filter(({ item }) => item.id === "cross")).toHaveLength(2)
    const overlap = segments.find(({ item }) => item.id === "overlap")!
    expect(overlap.columnCount).toBeGreaterThan(1)
    const abut = segments.find(({ item }) => item.id === "abut")!
    expect(abut.column).toBe(0)
  })

  it("places stable all-day lanes and clips continuation metadata", () => {
    const segments = layoutAgendaAllDaySegments([
      createAllDayItem({ id: "long", startDate: "2026-07-26", endDate: "2026-07-29" }),
      createAllDayItem({ id: "short", startDate: "2026-07-27", endDate: "2026-07-27" }),
    ], ["2026-07-27", "2026-07-28"], "UTC")
    expect(segments[0]).toMatchObject({ continuedBefore: true, continuedAfter: true, lane: 0 })
    expect(segments[1].lane).toBe(1)
  })

  it("expands timed events into collision-free columns on their right", () => {
    const at = (hour: number) => new Date(`2026-07-27T${String(hour + 7).padStart(2, "0")}:00:00Z`)
    const segments = layoutAgendaTimedSegments([
      createTimedItem({ id: "long", start: at(9), end: at(12) }),
      createTimedItem({ id: "short-a", start: at(9), end: at(10) }),
      createTimedItem({ id: "short-b", start: at(9), end: at(10) }),
      createTimedItem({ id: "expand", start: at(10), end: at(11) }),
    ], ["2026-07-27"], "America/Los_Angeles")
    expect(segments.find(({ item }) => item.id === "expand")?.columnSpan).toBe(2)
  })
})
