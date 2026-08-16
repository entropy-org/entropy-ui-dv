import { useStore } from "zustand"
import { useKanbanStoreApi } from "../context/kanban-context.js"
import type { KanbanState } from "../types.js"

export function useKanbanStore<T>(selector: (state: KanbanState) => T): T {
  return useStore(useKanbanStoreApi(), selector)
}
