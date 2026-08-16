import { useEffect, useRef } from "react"

export type ShiftWheelHandler = (delta: number, event: WheelEvent) => void

/**
 * Handles Shift+wheel with a non-passive listener so the gesture can be
 * redirected without also scrolling the page.
 */
export function useShiftWheel(
  elementRef: React.RefObject<HTMLElement | null>,
  onShiftWheel: ShiftWheelHandler,
  enabled = true
) {
  const handlerRef = useRef(onShiftWheel)

  useEffect(() => {
    handlerRef.current = onShiftWheel
  }, [onShiftWheel])

  useEffect(() => {
    if (!enabled) return
    const element = elementRef.current
    if (!element) return

    const handleWheel = (event: WheelEvent) => {
      if (!event.shiftKey) return

      const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX
      if (delta === 0) return

      event.preventDefault()
      handlerRef.current(delta, event)
    }

    element.addEventListener("wheel", handleWheel, { passive: false })
    return () => element.removeEventListener("wheel", handleWheel)
  }, [elementRef, enabled])
}
