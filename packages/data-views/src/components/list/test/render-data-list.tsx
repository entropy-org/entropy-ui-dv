import { render, type RenderResult } from "@testing-library/react"
import type { ReactNode } from "react"
import { DataListConfigContext } from "../context/data-list-config-context.js"
import { DataListContext } from "../context/data-list-context.js"
import {
  createDataListStore,
  type DataListStore,
} from "../store/create-store.js"
import type { DataListConfig } from "../types.js"

export interface RenderDataListResult {
  readonly renderResult: RenderResult
  readonly store: DataListStore
}

export function renderDataList<TData>(
  ui: ReactNode,
  config: DataListConfig<TData>
): RenderDataListResult {
  const search = config.operations?.search
  const store = createDataListStore({
    selection:
      config.selection?.mode === "none"
        ? undefined
        : (config.selection?.value ?? config.selection?.defaultValue),
    searchQuery:
      search?.mode === "controlled" ? search.query : search?.defaultQuery,
  })
  const renderResult = render(
    <DataListConfigContext.Provider
      value={config as unknown as DataListConfig<unknown>}
    >
      <DataListContext.Provider value={store}>{ui}</DataListContext.Provider>
    </DataListConfigContext.Provider>
  )
  return { renderResult, store }
}
