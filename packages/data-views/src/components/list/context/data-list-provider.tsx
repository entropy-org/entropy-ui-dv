import { type ReactNode, useEffect, useState } from "react"
import { DataListConfigContext } from "./data-list-config-context.js"
import { DataListContext } from "./data-list-context.js"
import { createDataListStore } from "../store/create-store.js"
import type { DataListConfig } from "../types.js"

export interface DataListProviderProps<TData> {
  readonly config: DataListConfig<TData>
  readonly children: ReactNode
}

export function DataListProvider<TData>({
  config,
  children,
}: DataListProviderProps<TData>) {
  const initialSearch = config.operations?.search
  const [store] = useState(() =>
    createDataListStore({
      selection:
        config.selection?.mode === "none"
          ? undefined
          : (config.selection?.value ?? config.selection?.defaultValue),
      searchQuery:
        initialSearch?.mode === "controlled"
          ? initialSearch.query
          : initialSearch?.defaultQuery,
    })
  )

  useEffect(() => {
    if (
      config.selection?.mode !== "none" &&
      config.selection?.value !== undefined
    ) {
      store.getState().actions.syncControlledSelection(config.selection.value)
    }
  }, [config.selection, store])

  useEffect(() => {
    const search = config.operations?.search
    if (search?.mode === "controlled") {
      store.getState().actions.setSearchQuery(search.query)
    }
  }, [config.operations?.search, store])

  useEffect(
    () => () => {
      store.getState().actions.reset()
    },
    [store]
  )

  return (
    <DataListConfigContext.Provider
      value={config as unknown as DataListConfig<unknown>}
    >
      <DataListContext.Provider value={store}>
        {children}
      </DataListContext.Provider>
    </DataListConfigContext.Provider>
  )
}
