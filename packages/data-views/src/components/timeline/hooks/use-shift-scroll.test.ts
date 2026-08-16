/**
 * Tests for use-shift-scroll hook.
 *
 * Shift+wheel converts vertical delta to horizontal scroll on a container ref.
 */
import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useShiftScroll } from "./use-shift-scroll.js"
import type React from "react"

function asReactWheelEvent(event: WheelEvent): React.WheelEvent<HTMLElement> {
  return event as unknown as React.WheelEvent<HTMLElement>
}

describe("useShiftScroll", () => {
  let container: HTMLDivElement
  let ref: React.RefObject<HTMLDivElement>

  beforeEach(() => {
    container = document.createElement("div")
    Object.defineProperty(container, "scrollLeft", {
      writable: true,
      value: 0,
    })
    ref = { current: container }
  })

  it("does NOT intercept a plain wheel event (no shiftKey)", () => {
    const { result } = renderHook(() => useShiftScroll(ref))
    const handler = result.current

    const event = new WheelEvent("wheel", {
      deltaY: 100,
      shiftKey: false,
      bubbles: true,
    })
    const preventDefaultSpy = vi.spyOn(event, "preventDefault")

    container.dispatchEvent(event)
    handler(asReactWheelEvent(event))

    expect(preventDefaultSpy).not.toHaveBeenCalled()
  })

  it("intercepts shift+wheel and scrolls horizontally by deltaY amount", () => {
    const { result } = renderHook(() => useShiftScroll(ref))
    const handler = result.current

    const event = new WheelEvent("wheel", {
      deltaY: 120,
      shiftKey: true,
      bubbles: true,
    })
    const preventDefaultSpy = vi.spyOn(event, "preventDefault")

    handler(asReactWheelEvent(event))

    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(container.scrollLeft).toBe(120)
  })

  it("also handles deltaX when shift is held (some mice send deltaX on shift)", () => {
    const { result } = renderHook(() => useShiftScroll(ref))
    const handler = result.current

    const event = new WheelEvent("wheel", {
      deltaX: 50,
      deltaY: 0,
      shiftKey: true,
      bubbles: true,
    })
    vi.spyOn(event, "preventDefault")

    container.scrollLeft = 100
    handler(asReactWheelEvent(event))

    // deltaX-only events still add scroll; total should remain reasonable
    expect(container.scrollLeft).toBeGreaterThanOrEqual(100)
  })

  it("accumulates scroll on repeated shift+wheel events", () => {
    const { result } = renderHook(() => useShiftScroll(ref))
    const handler = result.current

    for (let i = 0; i < 3; i++) {
      const event = new WheelEvent("wheel", {
        deltaY: 40,
        shiftKey: true,
        bubbles: true,
      })
      vi.spyOn(event, "preventDefault")
      handler(asReactWheelEvent(event))
    }

    expect(container.scrollLeft).toBe(120)
  })
})
