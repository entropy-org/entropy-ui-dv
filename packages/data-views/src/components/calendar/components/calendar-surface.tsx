import React from "react"
import { Calendar, type CalendarProps } from "./calendar.js"

export type CalendarSurfaceProps = CalendarProps

/** Calendar surface with its required date-navigation header. */
export const CalendarSurface = React.memo(
  React.forwardRef<HTMLDivElement, CalendarSurfaceProps>(
    function CalendarSurface(props, ref) {
      return <Calendar ref={ref} {...props} />
    }
  )
)
