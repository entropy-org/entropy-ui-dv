import { useContext } from "react"
import { useStore } from "zustand"
import { DataListContext } from "../context/data-list-context.js"
import type { DataListState } from "../store/types.js"

export function useDataListStore<T>(selector: (state: DataListState) => T): T {
  const store = useContext(DataListContext)
  if (!store) {
    throw new Error("useDataListStore must be used within a <DataListProvider>")
  }
  return useStore(store, selector)
}

export function useDataListStoreApi() {
  const store = useContext(DataListContext)
  if (!store) {
    throw new Error(
      "useDataListStoreApi must be used within a <DataListProvider>"
    )
  }
  return store
}
