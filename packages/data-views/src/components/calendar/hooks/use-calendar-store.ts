import { useStore } from "zustand"
import { useCalendarStoreApi } from "../context/calendar-context.js"
import type { CalendarState } from "../types.js"

/** Selector-required hook; full-store subscriptions are intentionally impossible. */
export function useCalendarStore<T>(selector: (state: CalendarState) => T): T {
  return useStore(useCalendarStoreApi(), selector)
}
