/**
 * Hook: useShiftScroll
 *
 * Intercepts wheel events on a container element. When `shiftKey` is held,
 * converts vertical scroll delta to horizontal scrollLeft movement.
 *
 * This enables horizontal timeline navigation with Shift+MouseWheel without
 * requiring a horizontal mouse or trackpad swipe.
 *
 * @param containerRef - Ref to the scrollable container element
 * @returns A stable wheel event handler to attach to the container
 */
import { useCallback } from "react"
import type { RefObject, WheelEventHandler } from "react"

/**
 * Returns a `onWheel` handler that redirects vertical scroll to horizontal
 * scroll when Shift is held.
 *
 * Attach the returned handler to the scroll container's `onWheel` prop,
 * **and** add a passive:false native listener if you need `preventDefault`
 * to work (React synthetic events are passive by default in React 17+).
 */
export function useShiftScroll(
  containerRef: RefObject<HTMLElement | null>
): WheelEventHandler<HTMLElement> {
  return useCallback(
    (event: React.WheelEvent<HTMLElement> | WheelEvent) => {
      if (!event.shiftKey) return
      if (!containerRef.current) return

      event.preventDefault()

      // Prefer vertical delta (standard scroll wheel), fall back to horizontal
      const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX
      containerRef.current.scrollLeft += delta
    },
    [containerRef]
  )
}
