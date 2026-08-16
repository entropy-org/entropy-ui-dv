/**
 * Tests for use-drag hook.
 *
 * Verifies the local-then-commit pattern:
 * - pointermove → position tracked via ref (zero store writes)
 * - pointerup → single store commit with correct snapped dates
 * - Escape during drag → cancels and restores original position
 */
import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import React from "react"
import { useDrag } from "./use-drag.js"
import { createTimelineStore } from "../store/create-store.js"
import { createTestItems } from "../test/fixtures.js"
import { TimelineContext } from "../context/timeline-context.js"
import { getColumnWidth } from "../utils/viewport-config.js"

describe("useDrag", () => {
  let store: ReturnType<typeof createTimelineStore>

  const origin = new Date("2026-07-01T00:00:00Z")
  // item-1 spans seven calendar days.
  const items = createTestItems(3)

  beforeEach(() => {
    store = createTimelineStore({
      items,
      viewportMode: "day",
      snapToGrid: false,
    })
    // Patch RAF to be synchronous in tests
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makeWrapper(s: ReturnType<typeof createTimelineStore>) {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(TimelineContext.Provider, { value: s }, children)
  }

  it("sets isDragging=true while dragging", () => {
    const barRef = { current: document.createElement("div") }
    const { result } = renderHook(
      () => useDrag({ item: items[0], origin, barRef }),
      { wrapper: makeWrapper(store) }
    )

    act(() => result.current.handlePointerDown(mockPointerEvent(100)))
    expect(result.current.isDragging).toBe(true)
  })

  it("isDragging=false after pointerup", () => {
    const barRef = { current: document.createElement("div") }
    const { result } = renderHook(
      () => useDrag({ item: items[0], origin, barRef }),
      { wrapper: makeWrapper(store) }
    )

    act(() => result.current.handlePointerDown(mockPointerEvent(100)))
    act(() => result.current.handlePointerMove(mockPointerEvent(140)))
    act(() => result.current.handlePointerUp(mockPointerEvent(140)))
    expect(result.current.isDragging).toBe(false)
  })

  it("commits updated dates after moving right by one day column", () => {
    const barRef = { current: document.createElement("div") }
    const colWidth = getColumnWidth("day")

    const { result } = renderHook(
      () => useDrag({ item: items[0], origin, barRef }),
      { wrapper: makeWrapper(store) }
    )

    act(() => result.current.handlePointerDown(mockPointerEvent(0)))
    act(() => result.current.handlePointerMove(mockPointerEvent(colWidth)))
    act(() => result.current.handlePointerUp(mockPointerEvent(colWidth)))

    const updated = store.getState().items.get("item-1")!
    // shifted +1 day
    expect(updated.startDate.getTime()).toBeGreaterThan(
      items[0].startDate.getTime()
    )
    expect(updated.endDate.getTime()).toBeGreaterThan(
      items[0].endDate.getTime()
    )
    // duration preserved
    const origDuration =
      items[0].endDate.getTime() - items[0].startDate.getTime()
    const newDuration = updated.endDate.getTime() - updated.startDate.getTime()
    expect(newDuration).toBe(origDuration)
  })

  it("moves only the parent item and leaves its child unchanged", () => {
    const parent = { ...items[0], id: "parent" }
    const child = { ...items[1], id: "child", parentId: parent.id }
    const parentStore = createTimelineStore({
      items: [parent, child],
      viewportMode: "day",
      snapToGrid: false,
    })
    const barRef = { current: document.createElement("div") }
    const { result } = renderHook(
      () => useDrag({ item: parent, origin, barRef }),
      { wrapper: makeWrapper(parentStore) }
    )

    act(() => result.current.handlePointerDown(mockPointerEvent(0)))
    act(() =>
      result.current.handlePointerUp(mockPointerEvent(getColumnWidth("day")))
    )

    expect(
      parentStore.getState().items.get(parent.id)!.startDate.getTime()
    ).toBeGreaterThan(parent.startDate.getTime())
    expect(parentStore.getState().items.get(child.id)).toEqual(child)
  })

  it("publishes the moving range without committing item dates", () => {
    const barRef = { current: document.createElement("div") }
    const dayWidth = getColumnWidth("day")

    const { result } = renderHook(
      () => useDrag({ item: items[0], origin, barRef }),
      { wrapper: makeWrapper(store) }
    )

    act(() => result.current.handlePointerDown(mockPointerEvent(0)))
    act(() => result.current.handlePointerMove(mockPointerEvent(dayWidth)))

    expect(store.getState().items.get("item-1")!.startDate).toEqual(
      items[0].startDate
    )
    expect(store.getState().rangeHighlight).toMatchObject({
      type: "drag",
      itemId: "item-1",
    })
    expect(
      store.getState().rangeHighlight!.startDate.getTime()
    ).toBeGreaterThan(items[0].startDate.getTime())

    act(() => result.current.handlePointerUp(mockPointerEvent(dayWidth)))
    expect(store.getState().rangeHighlight).toBeNull()
  })

  it("keeps the preview under the pointer while the viewport auto-scrolls", () => {
    const barRef = { current: document.createElement("div") }
    const { result } = renderHook(
      () => useDrag({ item: items[0], origin, barRef }),
      { wrapper: makeWrapper(store) }
    )

    act(() => result.current.handlePointerDown(mockPointerEvent(100)))
    act(() => store.getState().actions.scrollTo(80))

    expect(barRef.current.style.transform).toBe("translate3d(80px, 0, 0)")

    act(() => result.current.handlePointerUp(mockPointerEvent(100)))
    expect(
      store.getState().items.get("item-1")!.startDate.getTime()
    ).toBeGreaterThan(items[0].startDate.getTime())
  })

  it("Escape during drag cancels and does not commit", () => {
    const barRef = { current: document.createElement("div") }

    const { result } = renderHook(
      () => useDrag({ item: items[0], origin, barRef }),
      { wrapper: makeWrapper(store) }
    )

    const originalStart = items[0].startDate.getTime()

    act(() => result.current.handlePointerDown(mockPointerEvent(0)))
    act(() => result.current.handlePointerMove(mockPointerEvent(200)))
    act(() => result.current.handleCancel())

    expect(result.current.isDragging).toBe(false)
    // Item should be unchanged
    const item = store.getState().items.get("item-1")!
    expect(item.startDate.getTime()).toBe(originalStart)
  })

  it("does not start drag in readOnly mode", () => {
    const readOnlyStore = createTimelineStore({ items, readOnly: true })
    const barRef = { current: document.createElement("div") }

    const { result } = renderHook(
      () => useDrag({ item: items[0], origin, barRef }),
      { wrapper: makeWrapper(readOnlyStore) }
    )

    act(() => result.current.handlePointerDown(mockPointerEvent(0)))
    expect(result.current.isDragging).toBe(false)
  })
})

// ── Helpers ────────────────────────────────────────────────────────────────

function mockPointerEvent(clientX: number): React.PointerEvent<Element> {
  return {
    clientX,
    clientY: 0,
    pointerId: 1,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    currentTarget: document.createElement("div"),
    type: "pointermove",
  } as unknown as React.PointerEvent<Element>
}
