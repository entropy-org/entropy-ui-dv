import React from "react"
import { act, renderHook } from "@testing-library/react"
import { differenceInCalendarDays, differenceInMinutes } from "date-fns"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TimelineContext } from "../context/timeline-context.js"
import { useResize } from "./use-resize.js"
import { createTimelineStore } from "../store/create-store.js"
import { createTestItem } from "../test/fixtures.js"
import type { ViewportMode } from "../types.js"
import {
  dateRangeToPxWidth,
  dateToPx,
} from "../utils/position-utils.js"
import {
  getColumnWidth,
  getDayWidth,
} from "../utils/viewport-config.js"

describe("useResize", () => {
  const origin = new Date(2026, 6, 1)
  const item = createTestItem({
    id: "item-1",
    startDate: new Date(2026, 6, 14),
    endDate: new Date(2026, 6, 21),
  })

  let store: ReturnType<typeof createTimelineStore>

  beforeEach(() => {
    store = createTimelineStore({
      items: [item],
      viewportMode: "day",
      snapToGrid: false,
    })
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makeWrapper(currentStore: typeof store) {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        TimelineContext.Provider,
        { value: currentStore },
        children
      )
  }

  function renderResize(
    handle: "left" | "right",
    viewportMode: ViewportMode = "day"
  ) {
    const currentStore =
      viewportMode === "day"
        ? store
        : createTimelineStore({ items: [item], viewportMode })
    const bar = document.createElement("div")
    bar.style.left = `${dateToPx(item.startDate, origin, viewportMode)}px`
    bar.style.width = `${dateRangeToPxWidth(
      item.startDate,
      item.endDate,
      viewportMode
    )}px`
    const barRef = { current: bar }
    const rendered = renderHook(
      () => useResize({ item, origin, barRef, handle }),
      { wrapper: makeWrapper(currentStore) }
    )

    return { ...rendered, bar, currentStore }
  }

  it("moves the right edge by exactly one day even when grid snapping is disabled", () => {
    const { result, currentStore } = renderResize("right")
    const pointerX = 800

    act(() => result.current.handlePointerDown(mockPointerEvent(pointerX)))
    act(() =>
      result.current.handlePointerUp(
        mockPointerEvent(pointerX + getDayWidth("day"))
      )
    )

    const updated = currentStore.getState().items.get(item.id)!
    expect(updated.startDate.getTime()).toBe(item.startDate.getTime())
    expect(differenceInCalendarDays(updated.endDate, item.endDate)).toBe(1)
  })

  it("moves the left edge by exactly one day", () => {
    const { result, currentStore } = renderResize("left")
    const pointerX = 520

    act(() => result.current.handlePointerDown(mockPointerEvent(pointerX)))
    act(() =>
      result.current.handlePointerUp(
        mockPointerEvent(pointerX - getDayWidth("day"))
      )
    )

    const updated = currentStore.getState().items.get(item.id)!
    expect(updated.endDate.getTime()).toBe(item.endDate.getTime())
    expect(differenceInCalendarDays(item.startDate, updated.startDate)).toBe(1)
  })

  it("resizes only the parent item and leaves its child unchanged", () => {
    const parent = createTestItem({
      id: "parent",
      startDate: new Date(2026, 6, 14),
      endDate: new Date(2026, 6, 21),
    })
    const child = createTestItem({
      id: "child",
      parentId: parent.id,
      startDate: new Date(2026, 6, 16),
      endDate: new Date(2026, 6, 18),
    })
    const parentStore = createTimelineStore({
      items: [parent, child],
      viewportMode: "day",
      snapToGrid: false,
    })
    const barRef = { current: document.createElement("div") }
    const { result } = renderHook(
      () =>
        useResize({
          item: parent,
          origin,
          barRef,
          handle: "right",
        }),
      { wrapper: makeWrapper(parentStore) }
    )
    const pointerX = 800

    act(() => result.current.handlePointerDown(mockPointerEvent(pointerX)))
    act(() =>
      result.current.handlePointerUp(
        mockPointerEvent(pointerX + getDayWidth("day"))
      )
    )

    expect(
      differenceInCalendarDays(
        parentStore.getState().items.get(parent.id)!.endDate,
        parent.endDate
      )
    ).toBe(1)
    expect(parentStore.getState().items.get(child.id)).toEqual(child)
  })

  it("updates the bar and header range immediately during auto-scroll", () => {
    const { result, bar, currentStore } = renderResize("right")
    const initialWidth = dateRangeToPxWidth(item.startDate, item.endDate, "day")

    act(() => result.current.handlePointerDown(mockPointerEvent(800)))
    act(() => currentStore.getState().actions.scrollTo(getDayWidth("day")))

    expect(bar.style.width).toBe(`${initialWidth + getDayWidth("day")}px`)
    expect(currentStore.getState().rangeHighlight).toMatchObject({
      type: "resize",
      itemId: item.id,
      activeEdge: "end",
    })
    const highlight = currentStore.getState().rangeHighlight
    expect(highlight?.endDate).toEqual(new Date(2026, 6, 22))

    act(() => result.current.handlePointerUp(mockPointerEvent(800)))
    expect(currentStore.getState().rangeHighlight).toBeNull()
  })

  it("resizes the hour view in exact fifteen-minute steps", () => {
    const { result, bar, currentStore } = renderResize("right", "hours")
    const pointerX = 800
    const initialWidth = dateRangeToPxWidth(
      item.startDate,
      item.endDate,
      "hours"
    )

    act(() => result.current.handlePointerDown(mockPointerEvent(pointerX)))
    act(() =>
      result.current.handlePointerMove(
        mockPointerEvent(pointerX + getColumnWidth("hours"))
      )
    )

    const preview = currentStore.getState().rangeHighlight
    expect(preview).toMatchObject({
      type: "resize",
      activeEdge: "end",
    })
    expect(differenceInMinutes(preview!.endDate, item.endDate)).toBe(15)
    expect(bar.style.left).toBe(
      `${dateToPx(item.startDate, origin, "hours")}px`
    )
    expect(bar.style.width).toBe(`${initialWidth + getColumnWidth("hours")}px`)

    act(() =>
      result.current.handlePointerUp(
        mockPointerEvent(pointerX + getColumnWidth("hours"))
      )
    )
    const updated = currentStore.getState().items.get(item.id)!
    expect(differenceInMinutes(updated.endDate, item.endDate)).toBe(15)
  })

  it.each<ViewportMode>(["day", "week", "bi-week", "month", "quarter", "year"])(
    "enforces a one-day minimum duration in %s mode",
    (viewportMode) => {
      const { result, currentStore } = renderResize("right", viewportMode)

      act(() => result.current.handlePointerDown(mockPointerEvent(800)))
      act(() => result.current.handlePointerUp(mockPointerEvent(-10_000)))

      const updated = currentStore.getState().items.get(item.id)!
      expect(differenceInCalendarDays(updated.endDate, updated.startDate)).toBe(
        1
      )
    }
  )

  it("enforces a fifteen-minute minimum duration in hours mode", () => {
    const { result, currentStore } = renderResize("right", "hours")

    act(() => result.current.handlePointerDown(mockPointerEvent(800)))
    act(() => result.current.handlePointerUp(mockPointerEvent(-100_000)))

    const updated = currentStore.getState().items.get(item.id)!
    expect(differenceInMinutes(updated.endDate, updated.startDate)).toBe(15)
  })

  it("does not resize in read-only mode", () => {
    const readOnlyStore = createTimelineStore({
      items: [item],
      readOnly: true,
    })
    const barRef = { current: document.createElement("div") }
    const { result } = renderHook(
      () => useResize({ item, origin, barRef, handle: "right" }),
      { wrapper: makeWrapper(readOnlyStore) }
    )

    act(() => result.current.handlePointerDown(mockPointerEvent(800)))
    act(() => result.current.handlePointerUp(mockPointerEvent(900)))

    expect(readOnlyStore.getState().items.get(item.id)!.endDate.getTime()).toBe(
      item.endDate.getTime()
    )
  })
})

function mockPointerEvent(clientX: number): React.PointerEvent<Element> {
  return {
    clientX,
    clientY: 0,
    pointerId: 1,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    currentTarget: document.createElement("div"),
    type: "pointerdown",
  } as unknown as React.PointerEvent<Element>
}
