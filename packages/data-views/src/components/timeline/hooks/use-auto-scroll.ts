/**
 * Hook: useAutoScroll
 *
 * Provides accelerating edge-scroll during drag operations.
 *
 * When the pointer is within `EDGE_ZONE` pixels of the left or right
 * edge of the container, a RAF loop continuously scrolls the container
 * at a speed proportional to how close the pointer is to the edge
 * (closer → faster).
 *
 * Usage:
 *   const autoScroll = useAutoScroll(viewportRef)
 *   // On pointermove:
 *   autoScroll.start(clientX)
 *   // On pointerup or cancel:
 *   autoScroll.stop()
 */
import type { RefObject } from "react"
import { useCallback, useRef } from "react"

/** Pixels from the edge within which auto-scroll activates */
const EDGE_ZONE = 120
/** Maximum scroll speed in px/frame */
const MAX_SPEED = 35

export interface AutoScrollControls {
  /**
   * Update the pointer position and start/continue scrolling if near an edge.
   * Safe to call on every pointermove event.
   *
   * @param clientX - Current pointer X relative to the viewport
   */
  start: (clientX: number) => void
  /** Stop auto-scrolling. Call on pointerup or drag cancel. */
  stop: () => void
}

/**
 * Returns auto-scroll controls for a scrollable container.
 *
 * @param containerRef - Ref to the scrollable container element
 */
export function useAutoScroll(
  containerRef: RefObject<HTMLElement | null>,
  onScroll?: (scrollLeft: number) => void
): AutoScrollControls {
  const rafIdRef = useRef<number | null>(null)
  const clientXRef = useRef(0)

  const tick = useCallback(
    function tickFrame() {
      const container = containerRef.current
      if (!container) return

      // exactly where the container sits on the screen
      const rect = container.getBoundingClientRect()
      // pointer's X coordinate
      const clientX = clientXRef.current

      // figure out exactly how close the pointer is to either edge.
      const distFromLeft = clientX - rect.left
      const distFromRight = rect.right - clientX

      let speed = 0

      // If the pointer is within 80px of the left edge, it uses lerp to calculate a negative speed (scrolling left).
      if (distFromLeft < EDGE_ZONE) {
        // Closer to left edge → scroll left (negative direction)
        speed = -lerp(MAX_SPEED, 0, distFromLeft / EDGE_ZONE)
      } else if (distFromRight < EDGE_ZONE) {
        // Closer to right edge → scroll right (positive direction)
        speed = lerp(MAX_SPEED, 0, distFromRight / EDGE_ZONE)
      }

      if (speed !== 0) {
        container.scrollLeft += speed
        onScroll?.(container.scrollLeft)
      }

      rafIdRef.current = requestAnimationFrame(tickFrame)
    },
    [containerRef, onScroll]
  )

  const start = useCallback(
    (clientX: number) => {
      clientXRef.current = clientX

      // If a RAF loop is already running, just update the pointer position
      if (rafIdRef.current !== null) return

      rafIdRef.current = requestAnimationFrame(tick)
    },
    [tick]
  )

  const stop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
  }, [])

  return { start, stop }
}

/** Linear interpolation: returns `a` when `t=0`, `b` when `t=1` */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t))
}
