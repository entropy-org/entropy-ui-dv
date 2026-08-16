import { createContext, useContext } from "react"
import type { KanbanPreferences } from "../types.js"
import type { NormalizedKanbanData } from "../utils/normalize.js"

export interface KanbanDataContextValue {
  readonly normalized: NormalizedKanbanData
  readonly preferences: KanbanPreferences
}

export const KanbanDataContext = createContext<KanbanDataContextValue | null>(null)

export function useKanbanData() {
  const data = useContext(KanbanDataContext)
  if (!data) throw new Error("useKanbanData must be used inside a <KanbanProvider>.")
  return data
}
