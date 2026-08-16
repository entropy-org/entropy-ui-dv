/**
 * Items slice — manages timeline item data, ordering, and undo/redo history.
 */
import type { StateCreator } from "zustand"
import type {
  TimelineItem,
  TimelineState,
} from "../../types.js"
import { MAX_UNDO_HISTORY } from "../../constants.js"

/** Snapshot of item state for undo/redo */
interface ItemSnapshot {
  items: Map<string, TimelineItem>
  itemOrder: string[]
}

/** Push a snapshot onto the undo stack, capping at MAX_UNDO_HISTORY */
function pushUndo(
  undoStack: ItemSnapshot[],
  snapshot: ItemSnapshot
): ItemSnapshot[] {
  const next = [...undoStack, snapshot]
  if (next.length > MAX_UNDO_HISTORY) {
    return next.slice(next.length - MAX_UNDO_HISTORY)
  }
  return next
}

/** Take a snapshot of the current item state */
function takeSnapshot(state: {
  items: Map<string, TimelineItem>
  itemOrder: string[]
}): ItemSnapshot {
  return {
    items: new Map(state.items),
    itemOrder: [...state.itemOrder],
  }
}

/** Create the items slice */
export const createItemsSlice: StateCreator<
  TimelineState,
  [],
  [],
  Pick<
    TimelineState,
    "items" | "itemOrder" | "undoStack" | "redoStack" | "actions"
  >
> = (set, get) => ({
  items: new Map<string, TimelineItem>(),
  itemOrder: [] as string[],
  undoStack: [] as ItemSnapshot[],
  redoStack: [] as ItemSnapshot[],

  actions: {
    setItems: (items: TimelineItem[]) => {
      const state = get()
      const snapshot = takeSnapshot(state)
      const newItems = new Map<string, TimelineItem>()
      const newOrder: string[] = []
      for (const item of items) {
        newItems.set(item.id, item)
        newOrder.push(item.id)
      }
      set({
        items: newItems,
        itemOrder: newOrder,
        undoStack: pushUndo(state.undoStack, snapshot),
        redoStack: [],
      })
    },

    addItem: (item: TimelineItem) => {
      const state = get()
      const snapshot = takeSnapshot(state)
      const newItems = new Map(state.items)
      newItems.set(item.id, item)
      set({
        items: newItems,
        itemOrder: [...state.itemOrder, item.id],
        undoStack: pushUndo(state.undoStack, snapshot),
        redoStack: [],
      })
    },

    updateItem: (id: string, partial: Partial<TimelineItem>) => {
      const state = get()
      const existing = state.items.get(id)
      if (!existing) return

      const snapshot = takeSnapshot(state)
      const newItems = new Map(state.items)
      newItems.set(id, { ...existing, ...partial })
      set({
        items: newItems,
        undoStack: pushUndo(state.undoStack, snapshot),
        redoStack: [],
      })
    },

    removeItems: (ids: string[]) => {
      const state = get()
      const snapshot = takeSnapshot(state)
      const idSet = new Set(ids)
      const newItems = new Map(state.items)
      for (const id of ids) {
        newItems.delete(id)
      }
      set({
        items: newItems,
        itemOrder: state.itemOrder.filter((id) => !idSet.has(id)),
        undoStack: pushUndo(state.undoStack, snapshot),
        redoStack: [],
      })
    },

    undo: () => {
      const state = get()
      if (state.undoStack.length === 0) return

      const snapshot = takeSnapshot(state)
      const prev = state.undoStack[state.undoStack.length - 1]
      set({
        items: new Map(prev.items),
        itemOrder: [...prev.itemOrder],
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, snapshot],
      })
    },

    redo: () => {
      const state = get()
      if (state.redoStack.length === 0) return

      const snapshot = takeSnapshot(state)
      const next = state.redoStack[state.redoStack.length - 1]
      set({
        items: new Map(next.items),
        itemOrder: [...next.itemOrder],
        undoStack: [...state.undoStack, snapshot],
        redoStack: state.redoStack.slice(0, -1),
      })
    },
  } as TimelineState["actions"],
})
