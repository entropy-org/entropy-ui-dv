import React, { useEffect, useState } from "react"
import { startOfDay } from "date-fns"
import { useTimelineStore } from "../hooks/use-timeline-store.js"
import { dateToPx } from "../utils/position-utils.js"
import { getColumnWidth } from "../utils/viewport-config.js"

interface TimelineTodayMarkerProps {
  origin: Date
  height: number
}

/** Draws the current-time or current-day guide through the timeline grid. */
export const TimelineTodayMarker = React.memo(
  React.forwardRef<HTMLDivElement, TimelineTodayMarkerProps>(
    function TimelineTodayMarker({ origin, height }, ref) {
      const viewportMode = useTimelineStore((s) => s.viewportMode)

      // We use a state to force re-render if the component stays mounted across days
      // For tests, we use the initial time which can be mocked via vi.setSystemTime
      const [now, setNow] = useState(() => new Date())

      useEffect(() => {
        // Update the marker every minute so it moves in "hours" mode
        const interval = setInterval(() => {
          setNow(new Date())
        }, 60000)
        return () => clearInterval(interval)
      }, [])

      const left =
        viewportMode === "hours"
          ? dateToPx(now, origin, viewportMode)
          : dateToPx(startOfDay(now), origin, viewportMode) +
            getColumnWidth(viewportMode) / 2

      return (
        <div
          ref={ref}
          data-testid="timeline-today-marker"
          className="pointer-events-none absolute top-0 z-10 w-px -translate-x-1/2 bg-destructive/55"
          style={{
            left,
            height,
          }}
        />
      )
    }
  )
)
