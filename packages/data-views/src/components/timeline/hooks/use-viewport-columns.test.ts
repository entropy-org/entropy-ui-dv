import { describe, it, expect } from "vitest"
import { act } from "@testing-library/react"
import { renderTimelineHook } from "../test/render-timeline.js"
import {
  computeVirtualColumnRange,
  useViewportColumns,
} from "./use-viewport-columns.js"
import { createTestItems } from "../test/fixtures.js"
import { getColumnWidth } from "../utils/viewport-config.js"
import { createTimelineCanvasRange } from "../utils/timeline-range.js"

describe("useViewportColumns", () => {
  it("computes layout correctly for default mode (week) with items", () => {
    // create items starting at 2026-07-14
    const items = createTestItems(3, new Date("2026-07-14"))

    const { result } = renderTimelineHook(() => useViewportColumns(), { items })

    const expectedRange = createTimelineCanvasRange(
      new Map(items.map((item) => [item.id, item])),
      "week"
    )
    expect(result.current.origin.getTime()).toBe(expectedRange.origin.getTime())

    expect(result.current.columnWidth).toBe(getColumnWidth("week"))

    // Ensure we have some columns
    expect(result.current.columns.length).toBeGreaterThan(0)

    // totalWidth = columns * columnWidth
    expect(result.current.totalWidth).toBe(
      result.current.columns.length * result.current.columnWidth
    )
  })

  it("handles empty items fallback", () => {
    const { result } = renderTimelineHook(() => useViewportColumns(), {
      items: [],
      viewportMode: "day",
    })

    expect(result.current.totalWidth).toBeGreaterThanOrEqual(1600)
    expect(result.current.totalWidth).toBe(
      result.current.totalColumnCount * result.current.columnWidth
    )
    expect(result.current.columnWidth).toBe(getColumnWidth("day"))
  })

  it("includes the configured buffer at exact visible-range boundaries", () => {
    expect(
      computeVirtualColumnRange({
        scrollLeft: 80,
        viewportWidth: 80,
        columnWidth: 40,
        columnCount: 20,
        buffer: 3,
      })
    ).toEqual({ startIndex: 0, endIndex: 6 })

    expect(
      computeVirtualColumnRange({
        scrollLeft: 400,
        viewportWidth: 120,
        columnWidth: 40,
        columnCount: 20,
        buffer: 3,
      })
    ).toEqual({ startIndex: 7, endIndex: 15 })
  })

  it("extends the canvas on demand on both horizontal edges", () => {
    const items = createTestItems(2, new Date("2026-07-14"))
    const { result, store } = renderTimelineHook(() => useViewportColumns(), {
      items,
      viewportMode: "day",
      viewportWidth: 240,
    })

    const originBeforeLeftExtension = result.current.origin.getTime()
    act(() => store.getState().actions.scrollTo(0))

    expect(result.current.origin.getTime()).toBeLessThan(
      originBeforeLeftExtension
    )
    expect(store.getState().timelineOrigin.getTime()).toBe(
      result.current.origin.getTime()
    )

    const columnsBeforeRightExtension = result.current.totalColumnCount
    act(() =>
      store.getState().actions.scrollTo(result.current.totalWidth - 240)
    )

    expect(result.current.totalColumnCount).toBeGreaterThan(
      columnsBeforeRightExtension
    )
  })
})
