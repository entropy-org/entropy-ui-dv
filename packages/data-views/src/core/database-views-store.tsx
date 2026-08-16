"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { useStore } from "zustand"
import { createStore, type StoreApi } from "zustand/vanilla"
import type { DataViewRecordId } from "./types.js"

export type DatabaseViewsMenuState =
  | { readonly type: "closed" }
  | { readonly type: "create-view" }
  | { readonly type: "view-actions"; readonly viewId: string }

export interface DatabaseViewsActions {
  readonly setMenu: (menu: DatabaseViewsMenuState) => void
  readonly setSelectedRecordIds: (
    recordIds: ReadonlySet<DataViewRecordId>
  ) => void
  readonly clearSelection: () => void
}

export interface DatabaseViewsState {
  readonly menu: DatabaseViewsMenuState
  readonly selectedRecordIds: ReadonlySet<DataViewRecordId>
  readonly actions: DatabaseViewsActions
}

export function createDatabaseViewsStore() {
  return createStore<DatabaseViewsState>()((set) => ({
    menu: { type: "closed" },
    selectedRecordIds: new Set(),
    actions: {
      setMenu: (menu) => set({ menu }),
      setSelectedRecordIds: (recordIds) =>
        set({ selectedRecordIds: new Set(recordIds) }),
      clearSelection: () => set({ selectedRecordIds: new Set() }),
    },
  }))
}

export type DatabaseViewsStore = ReturnType<typeof createDatabaseViewsStore>

const DatabaseViewsStoreContext = createContext<StoreApi<DatabaseViewsState> | null>(
  null
)

export interface DatabaseViewsStoreProviderProps {
  readonly children: ReactNode
  readonly store?: DatabaseViewsStore
}

export function DatabaseViewsStoreProvider({
  children,
  store: providedStore,
}: DatabaseViewsStoreProviderProps) {
  const [store] = useState(() => providedStore ?? createDatabaseViewsStore())
  return (
    <DatabaseViewsStoreContext.Provider value={store}>
      {children}
    </DatabaseViewsStoreContext.Provider>
  )
}

export function useDatabaseViewsStoreApi() {
  const store = useContext(DatabaseViewsStoreContext)
  if (!store) {
    throw new Error(
      "useDatabaseViewsStoreApi must be used within DatabaseViewsStoreProvider."
    )
  }
  return store
}

export function useDatabaseViewsStore<TSelected>(
  selector: (state: DatabaseViewsState) => TSelected
) {
  return useStore(useDatabaseViewsStoreApi(), selector)
}
