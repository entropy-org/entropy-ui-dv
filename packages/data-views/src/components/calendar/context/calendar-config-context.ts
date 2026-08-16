import { createContext, useContext } from "react"
import type { CalendarConfig } from "../types.js"

export const CalendarConfigContext = createContext<CalendarConfig | null>(null)

export function useCalendarConfig(): CalendarConfig {
  const config = useContext(CalendarConfigContext)
  if (!config) {
    throw new Error(
      "useCalendarConfig must be used within a <CalendarProvider>"
    )
  }
  return config
}
