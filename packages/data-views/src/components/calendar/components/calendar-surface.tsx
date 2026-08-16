import React from "react"
import { Calendar, type CalendarProps } from "./calendar.js"

export type CalendarSurfaceProps = Omit<
  CalendarProps,
  "chrome" | "showHeader"
>

/** Headerless Calendar surface intended for `DatabaseViews` and custom shells. */
export const CalendarSurface = React.memo(
  React.forwardRef<HTMLDivElement, CalendarSurfaceProps>(
    function CalendarSurface(props, ref) {
      return <Calendar ref={ref} chrome={{ mode: "embedded" }} {...props} />
    }
  )
)
