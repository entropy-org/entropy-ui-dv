import type {
  CalendarUIActions,
  CalendarUISlice,
} from "../../types.js"
import type {
  CalendarStoreGet,
  CalendarStoreSet,
  CalendarStoreSlice,
} from "../slice-types.js"

export interface CreateUISliceOptions {
  readonly initialSearchQuery?: string
}

export function createUISlice(
  options: CreateUISliceOptions,
  set: CalendarStoreSet,
  get: CalendarStoreGet
): CalendarStoreSlice<CalendarUISlice, CalendarUIActions> {
  return {
    state: {
      searchQuery: options.initialSearchQuery ?? "",
      settingsOpen: false,
      overflow: { type: "closed" },
      hoveredItemId: null,
      announcement: "",
      announcementSequence: 0,
    },
    actions: {
      setSearchQuery: (query) => {
        if (get().searchQuery !== query) set({ searchQuery: query })
      },
      setSettingsOpen: (open) => {
        if (get().settingsOpen !== open) set({ settingsOpen: open })
      },
      openOverflow: (date, triggerId) => {
        const overflow = get().overflow
        if (
          overflow.type !== "open" ||
          overflow.date !== date ||
          overflow.triggerId !== triggerId
        ) {
          set({ overflow: { type: "open", date, triggerId } })
        }
      },
      closeOverflow: () => {
        if (get().overflow.type !== "closed") {
          set({ overflow: { type: "closed" } })
        }
      },
      setHoveredItem: (itemId) => {
        if (get().hoveredItemId !== itemId) set({ hoveredItemId: itemId })
      },
      announce: (message) => {
        const normalizedMessage = message.trim()
        if (!normalizedMessage) return
        set({
          announcement: normalizedMessage,
          announcementSequence: get().announcementSequence + 1,
        })
      },
    },
  }
}
