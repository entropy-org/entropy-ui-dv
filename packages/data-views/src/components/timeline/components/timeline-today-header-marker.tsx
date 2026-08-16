import React, { useEffect, useState } from "react"
import { format, startOfDay } from "date-fns"
import type { ViewportMode } from "../types.js"
import { dateToPx } from "../utils/position-utils.js"

interface TimelineTodayHeaderMarkerProps {
  columnWidth: number
  mode: ViewportMode
  origin: Date
}

/** Displays the current time or date directly on the secondary header. */
export const TimelineTodayHeaderMarker = React.memo(
  React.forwardRef<HTMLDivElement, TimelineTodayHeaderMarkerProps>(
    function TimelineTodayHeaderMarker({ columnWidth, mode, origin }, ref) {
      const [now, setNow] = useState(() => new Date())

      useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000)
        return () => clearInterval(interval)
      }, [])

      const left =
        mode === "hours"
          ? dateToPx(now, origin, mode)
          : dateToPx(startOfDay(now), origin, mode) + columnWidth / 2

      if (mode === "hours") {
        return (
          <div
            ref={ref}
            data-testid="timeline-today-header-marker"
            className="text-destructive-foreground pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive px-1.5 py-0.5 text-[9px] leading-none font-semibold whitespace-nowrap shadow-sm ring-2 ring-background"
            style={{ left }}
            aria-label={`Current time, ${format(now, "h:mm a")}`}
          >
            {format(now, "h:mma").toLowerCase()}
          </div>
        )
      }

      return (
        <div
          ref={ref}
          data-testid="timeline-today-header-marker"
          className="text-destructive-foreground pointer-events-none absolute top-1/2 z-10 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-destructive text-[9px] font-semibold shadow-sm ring-[6px] ring-background"
          style={{ left }}
          aria-label={`Today, ${format(now, "MMMM d")}`}
        >
          {format(now, "d")}
        </div>
      )
    }
  )
)
