import { createContext, useContext } from "react"
import type { KanbanStore } from "../store/create-store.js"

export const KanbanContext = createContext<KanbanStore | null>(null)

export function useKanbanStoreApi() {
  const store = useContext(KanbanContext)
  if (!store) throw new Error("useKanbanStore must be used inside a <KanbanProvider>.")
  return store
}
