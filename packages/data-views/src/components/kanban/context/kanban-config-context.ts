import { createContext, useContext } from "react"
import type { KanbanConfig } from "../types.js"

export const KanbanConfigContext = createContext<KanbanConfig | null>(null)

export function useKanbanConfig() {
  const config = useContext(KanbanConfigContext)
  if (!config) throw new Error("useKanbanConfig must be used inside a <KanbanProvider>.")
  return config
}
