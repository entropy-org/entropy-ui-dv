/**
 * Selection slice — manages selected item IDs and selection modes.
 *
 * Supports three selection modes:
 * - `replace`: clear current selection and select one item
 * - `toggle`: add/remove a single item from the selection (Cmd/Ctrl+click)
 * - `range`: select a contiguous range from last selected to target (Shift+click)
 */
import type { StateCreator } from "zustand"
import type { TimelineState } from "../../types.js"

/** Create the selection slice */
export const createSelectionSlice: StateCreator<
  TimelineState,
  [],
  [],
  Pick<TimelineState, "selectedIds" | "actions">
> = (set, get) => ({
  selectedIds: new Set<string>(),

  actions: {
    select: (id: string, mode: "replace" | "toggle" | "range") => {
      const state = get()
      switch (mode) {
        case "replace": {
          set({ selectedIds: new Set([id]) })
          break
        }
        case "toggle": {
          const next = new Set(state.selectedIds)
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
          set({ selectedIds: next })
          break
        }
        case "range": {
          // Find the range from the last selected item to the target
          const { itemOrder } = state
          const targetIndex = itemOrder.indexOf(id)
          if (targetIndex === -1) break

          // Find the index of the last item that was added to the selection
          let anchorIndex = -1
          for (let i = itemOrder.length - 1; i >= 0; i--) {
            if (state.selectedIds.has(itemOrder[i])) {
              anchorIndex = i
              break
            }
          }

          if (anchorIndex === -1) {
            // No previous selection — treat as replace
            set({ selectedIds: new Set([id]) })
            break
          }

          const start = Math.min(anchorIndex, targetIndex)
          const end = Math.max(anchorIndex, targetIndex)
          const next = new Set(state.selectedIds)
          for (let i = start; i <= end; i++) {
            next.add(itemOrder[i])
          }
          set({ selectedIds: next })
          break
        }
      }
    },

    selectAll: () => {
      const { itemOrder } = get()
      set({ selectedIds: new Set(itemOrder) })
    },

    clearSelection: () => {
      set({ selectedIds: new Set<string>() })
    },

    deleteSelected: () => {
      const state = get()
      if (state.selectedIds.size === 0) return
      const ids = [...state.selectedIds]
      // Use the items slice's removeItems action
      state.actions.removeItems(ids)
      set({ selectedIds: new Set<string>() })
    },
  } as TimelineState["actions"],
})
