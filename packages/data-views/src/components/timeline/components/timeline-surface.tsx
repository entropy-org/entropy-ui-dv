import React from "react"
import { Timeline, type TimelineProps } from "./timeline.js"

export type TimelineSurfaceProps = TimelineProps

/** Timeline surface with its required navigation header. */
export const TimelineSurface = React.memo(
  React.forwardRef<HTMLDivElement, TimelineSurfaceProps>(
    function TimelineSurface(props, ref) {
      return <Timeline ref={ref} {...props} />
    }
  )
)
