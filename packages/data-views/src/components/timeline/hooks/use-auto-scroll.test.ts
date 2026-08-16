/**
 * Tests for use-auto-scroll hook.
 *
 * When the pointer is near the left or right edge of a container:
 * - Produces scroll deltas that accelerate as the pointer gets closer to the edge
 * - Only active when isDragging is true
 * - Uses fake timers / RAF for deterministic testing
 */
import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useAutoScroll } from "./use-auto-scroll.js"

describe("useAutoScroll", () => {
  let container: HTMLDivElement

  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement("div")
    Object.defineProperty(container, "scrollLeft", { writable: true, value: 0 })
    Object.defineProperty(container, "offsetWidth", {
      writable: true,
      value: 800,
    })
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ left: 0, right: 800, width: 800 }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("does not scroll when pointer is in the middle of container", () => {
    let rafCallback: FrameRequestCallback | null = null
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCallback = cb
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", vi.fn())

    const containerRef = { current: container }
    const { result } = renderHook(() => useAutoScroll(containerRef))

    act(() => result.current.start(400)) // middle of 800px container
    if (rafCallback) act(() => (rafCallback as FrameRequestCallback)(16))

    expect(container.scrollLeft).toBe(0)
  })

  it("scrolls right when pointer is within edge zone on the right", () => {
    let rafCallback: FrameRequestCallback | null = null
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCallback = cb
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", vi.fn())

    const containerRef = { current: container }
    const { result } = renderHook(() => useAutoScroll(containerRef))

    // Pointer at 780 — 20px from right edge (within EDGE_ZONE of 80)
    act(() => result.current.start(780))
    if (rafCallback) act(() => (rafCallback as FrameRequestCallback)(16))

    expect(container.scrollLeft).toBeGreaterThan(0)
  })

  it("publishes every auto-scroll frame for range extension and drag preview", () => {
    let rafCallback: FrameRequestCallback | null = null
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCallback = cb
      return 1
    })
    const onScroll = vi.fn()
    const containerRef = { current: container }
    const { result } = renderHook(() => useAutoScroll(containerRef, onScroll))

    act(() => result.current.start(795))
    if (rafCallback) act(() => (rafCallback as FrameRequestCallback)(16))

    expect(onScroll).toHaveBeenCalledWith(container.scrollLeft)
    expect(container.scrollLeft).toBeGreaterThan(0)
  })

  it("scrolls left when pointer is within edge zone on the left", () => {
    let rafCallback: FrameRequestCallback | null = null
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCallback = cb
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", vi.fn())

    const containerRef = { current: container }
    const { result } = renderHook(() => useAutoScroll(containerRef))

    container.scrollLeft = 200

    act(() => result.current.start(20)) // 20px from left edge
    if (rafCallback) act(() => (rafCallback as FrameRequestCallback)(16))

    expect(container.scrollLeft).toBeLessThan(200)
  })

  it("stops scrolling after stop() is called", () => {
    const cancelSpy = vi.fn()
    vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(42))
    vi.stubGlobal("cancelAnimationFrame", cancelSpy)

    const containerRef = { current: container }
    const { result } = renderHook(() => useAutoScroll(containerRef))

    act(() => result.current.start(780))
    act(() => result.current.stop())

    expect(cancelSpy).toHaveBeenCalledWith(42)
  })

  it("does not scroll if container ref is null", () => {
    const containerRef = { current: null }
    const { result } = renderHook(() => useAutoScroll(containerRef))

    // Should not throw
    expect(() => act(() => result.current.start(10))).not.toThrow()
  })
})
