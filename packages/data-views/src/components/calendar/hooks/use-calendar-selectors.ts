import { useShallow } from "zustand/react/shallow"
import { useCalendarStore } from "./use-calendar-store.js"
import {
  selectSelectedIds,
  selectViewportDimensions,
} from "../store/selectors.js"

/** Stable shallow-selected IDs for components that need the full selection. */
export function useSelectedCalendarIds(): readonly string[] {
  return useCalendarStore(useShallow(selectSelectedIds))
}

/** Stable shallow-selected dimensions for measurement-aware containers. */
export function useCalendarViewportDimensions() {
  return useCalendarStore(useShallow(selectViewportDimensions))
}
