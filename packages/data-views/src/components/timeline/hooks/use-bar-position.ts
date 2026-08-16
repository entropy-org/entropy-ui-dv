/**
 * Hook: compute a single bar's pixel position.
 *
 * Wraps `getBarPosition` from position-utils, reading the
 * current viewport mode from the store. The origin is passed
 * in as a prop since it's computed once by the parent via
 * `useViewportColumns`.
 */
import { useMemo } from "react"
import { useTimelineStore } from "./use-timeline-store.js"
import {
  getBarPosition,
  type BarPosition,
} from "../utils/position-utils.js"

/**
 * Compute the pixel left-offset and width of a timeline bar.
 *
 * @param startDate - Item start date
 * @param endDate - Item end date
 * @param origin - Timeline origin date (from useViewportColumns)
 * @returns `{ left, width }` in pixels
 */
export function useBarPosition(
  startDate: Date,
  endDate: Date,
  origin: Date
): BarPosition {
  const viewportMode = useTimelineStore((s) => s.viewportMode)

  return useMemo(
    () => getBarPosition(startDate, endDate, origin, viewportMode),
    [startDate, endDate, origin, viewportMode]
  )
}
