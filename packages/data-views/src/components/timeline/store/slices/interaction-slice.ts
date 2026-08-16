/**
 * Interaction slice — manages drag state, hovered cell, ghost bar,
 * and active dependency port.
 */
import type { StateCreator } from "zustand"
import type {
  DragState,
  GhostBarState,
  HoveredCell,
  TimelineRangeHighlight,
  TimelineState,
} from "../../types.js"

/** Create the interaction slice */
export const createInteractionSlice: StateCreator<
  TimelineState,
  [],
  [],
  Pick<
    TimelineState,
    | "dragState"
    | "hoveredCell"
    | "ghostBar"
    | "rangeHighlight"
    | "activeDependencyPortId"
    | "actions"
  >
> = (set, get) => ({
  dragState: null,
  hoveredCell: null,
  ghostBar: null,
  rangeHighlight: null,
  activeDependencyPortId: null,

  actions: {
    startDrag: (drag: DragState) => {
      set({ dragState: drag })
    },

    updateDrag: (currentX: number) => {
      const { dragState } = get()
      if (!dragState) return
      set({
        dragState: { ...dragState, currentX },
      })
    },

    endDrag: () => {
      set({ dragState: null })
    },

    setHoveredCell: (cell: HoveredCell) => {
      set({ hoveredCell: cell })
    },

    clearHoveredCell: () => {
      set({ hoveredCell: null })
    },

    setGhostBar: (ghost: GhostBarState) => {
      set({ ghostBar: ghost })
    },

    clearGhostBar: () => {
      set({ ghostBar: null })
    },

    setRangeHighlight: (highlight: TimelineRangeHighlight) => {
      set({ rangeHighlight: highlight })
    },

    clearRangeHighlight: () => {
      set({ rangeHighlight: null })
    },

    setActiveDependencyPort: (id: string) => {
      set({ activeDependencyPortId: id })
    },

    clearActiveDependencyPort: () => {
      set({ activeDependencyPortId: null })
    },
  } as TimelineState["actions"],
})
