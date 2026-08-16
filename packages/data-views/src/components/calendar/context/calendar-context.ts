import { createContext, useContext } from "react"
import type { CalendarStore } from "../store/create-store.js"

export const CalendarContext = createContext<CalendarStore | null>(null)

/** Internal/advanced access to the instance store without subscribing. */
export function useCalendarStoreApi(): CalendarStore {
  const store = useContext(CalendarContext)
  if (!store) {
    throw new Error(
      "useCalendarStoreApi must be used within a <CalendarProvider>"
    )
  }
  return store
}
