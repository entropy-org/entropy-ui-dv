import React from "react"
import { Timeline, type TimelineProps } from "./timeline.js"

export type TimelineSurfaceProps = Omit<
  TimelineProps,
  "chrome" | "showHeader"
>

/** Headerless Timeline surface intended for `DatabaseViews` and custom shells. */
export const TimelineSurface = React.memo(
  React.forwardRef<HTMLDivElement, TimelineSurfaceProps>(
    function TimelineSurface(props, ref) {
      return <Timeline ref={ref} chrome={{ mode: "embedded" }} {...props} />
    }
  )
)
