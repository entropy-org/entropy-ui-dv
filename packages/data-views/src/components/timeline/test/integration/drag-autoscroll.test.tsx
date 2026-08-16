import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderTimeline } from "../render-timeline.js"
import { createTestItems } from "../fixtures.js"
import { Timeline } from "../../components/timeline.js"
import { fireEvent, act } from "@testing-library/react"

describe("Integration: Drag + Auto-Scroll", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("scrolls the viewport when a bar is dragged near the edge", () => {
    let rafCallback: FrameRequestCallback | null = null
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCallback = cb
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", vi.fn())

    const items = createTestItems(1)

    // We need to provide the viewport with some width so "near the edge" makes sense
    const { renderResult } = renderTimeline(<Timeline />, {
      items,
      viewportMode: "day",
    })

    const viewport = renderResult.container.querySelector(
      "[data-testid='timeline-viewport']"
    ) as HTMLDivElement
    expect(viewport).toBeTruthy()

    // Mock viewport rect and scroll
    Object.defineProperty(viewport, "getBoundingClientRect", {
      value: () => ({ left: 0, right: 800, width: 800 }),
    })
    Object.defineProperty(viewport, "scrollLeft", { writable: true, value: 0 })

    const bar = renderResult.container.querySelector(
      "[data-testid='timeline-bar-item-1']"
    )
    expect(bar).toBeTruthy()

    // Start drag
    act(() => {
      fireEvent.pointerDown(bar!, { clientX: 100, pointerId: 1 })
    })

    // Move pointer near the right edge (780px)
    act(() => {
      // We fire this on the viewport to ensure the root timeline component catches it if it listens there,
      // but in React event bubbling, firing on the bar bubbles up to the viewport anyway.
      fireEvent.pointerMove(viewport!, { clientX: 780, pointerId: 1 })
    })

    // Execute RAF (this should trigger the auto-scroll tick)
    if (rafCallback) {
      act(() => {
        ;(rafCallback as FrameRequestCallback)(16)
      })
    }

    // The viewport should have scrolled to the right (positive scrollLeft)
    expect(viewport.scrollLeft).toBeGreaterThan(0)

    // Stop drag
    act(() => {
      fireEvent.pointerUp(bar!, { clientX: 780, pointerId: 1 })
    })
  })
})
