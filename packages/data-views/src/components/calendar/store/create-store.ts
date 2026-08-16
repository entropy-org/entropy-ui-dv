import { createStore } from "zustand/vanilla"
import { createHistorySlice } from "./slices/history-slice.js"
import { createInteractionSlice } from "./slices/interaction-slice.js"
import { createSelectionSlice } from "./slices/selection-slice.js"
import { createUISlice } from "./slices/ui-slice.js"
import { createViewportSlice } from "./slices/viewport-slice.js"
import type {
  CalendarDate,
  CalendarState,
} from "../types.js"

export interface CreateCalendarStoreOptions {
  initialAnchorDate: CalendarDate
  initialFocusedDate?: CalendarDate | null
  initialSelectedIds?: readonly string[]
  initialSearchQuery?: string
}

/** Creates one independent client-only calendar store. */
export function createCalendarStore(options: CreateCalendarStoreOptions) {
  return createStore<CalendarState>()((set, get) => {
    const viewport = createViewportSlice(options, set, get)
    const history = createHistorySlice(set, get)
    const interaction = createInteractionSlice(set, get)
    const selection = createSelectionSlice(options, set, get)
    const ui = createUISlice(options, set, get)

    return {
      ...viewport.state,
      ...history.state,
      ...interaction.state,
      ...selection.state,
      ...ui.state,
      actions: {
        ...viewport.actions,
        ...history.actions,
        ...interaction.actions,
        ...selection.actions,
        ...ui.actions,
      },
    }
  })
}

export type CalendarStore = ReturnType<typeof createCalendarStore>
