import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderTimeline } from "../render-timeline.js"
import { createTestItems } from "../fixtures.js"
import { Timeline } from "../../components/timeline.js"
import { fireEvent, act } from "@testing-library/react"
import { getColumnWidth } from "../../utils/viewport-config.js"

describe("Integration: Bulk Drag", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(1))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("selects 3 items, drags one, and updates all 3 on commit", () => {
    const items = createTestItems(5)
    // item-1: 2026-07-14 -> 2026-07-21
    // item-2: 2026-07-17 -> 2026-07-24
    // item-3: 2026-07-20 -> 2026-07-27

    const { store, renderResult } = renderTimeline(<Timeline />, {
      items,
      viewportMode: "day",
      snapToGrid: false,
    })

    const originalStart1 = items[0].startDate.getTime()
    const originalStart2 = items[1].startDate.getTime()
    const originalStart3 = items[2].startDate.getTime()

    act(() => {
      // Select item-1, item-2, item-3
      store.getState().actions.select("item-1", "replace")
      store.getState().actions.select("item-3", "range")
    })

    expect(store.getState().selectedIds).toEqual(
      new Set(["item-1", "item-2", "item-3"])
    )

    // Drag item-1 right by one day column.
    const bar = renderResult.container.querySelector(
      "[data-testid='timeline-bar-item-1']"
    )
    expect(bar).toBeTruthy()

    const colWidth = getColumnWidth("day")

    act(() => {
      fireEvent.pointerDown(bar!, { clientX: 0, pointerId: 1 })
    })

    act(() => {
      fireEvent.pointerMove(bar!, { clientX: colWidth, pointerId: 1 })
    })

    act(() => {
      fireEvent.pointerUp(bar!, { clientX: colWidth, pointerId: 1 })
    })

    // Check store
    const updated1 = store.getState().items.get("item-1")!
    const updated2 = store.getState().items.get("item-2")!
    const updated3 = store.getState().items.get("item-3")!
    const untouched = store.getState().items.get("item-4")!

    // Delta should be +1 day (86400000 ms)
    const ONE_DAY = 24 * 60 * 60 * 1000

    expect(updated1.startDate.getTime()).toBe(originalStart1 + ONE_DAY)
    expect(updated2.startDate.getTime()).toBe(originalStart2 + ONE_DAY)
    expect(updated3.startDate.getTime()).toBe(originalStart3 + ONE_DAY)

    // Unselected items should not be changed
    expect(untouched.startDate.getTime()).toBe(items[3].startDate.getTime())
  })
})
