import { useEffect, useMemo, useRef } from "react"
import { useDataListConfig } from "../context/data-list-config-context.js"
import { useDataListStore } from "./use-data-list-store.js"
import {
  selectCollapsedGroups,
  selectCollapsedItems,
  selectSearchQuery,
} from "../store/selectors.js"
import { buildDataListModel } from "../utils/model.js"

export function useDataListModel<TData>() {
  const config = useDataListConfig<TData>()
  const query = useDataListStore(selectSearchQuery)
  const collapsedGroups = useDataListStore(selectCollapsedGroups)
  const toggledItems = useDataListStore(selectCollapsedItems)
  const reportedDiagnostics = useRef(new Set<string>())
  const model = useMemo(
    () =>
      buildDataListModel({
        config,
        query,
        collapsedGroups,
        toggledItems,
      }),
    [config, query, collapsedGroups, toggledItems]
  )

  useEffect(() => {
    for (const diagnostic of model.diagnostics) {
      const key = `${diagnostic.code}:${diagnostic.itemId ?? ""}:${diagnostic.propertyId ?? ""}:${diagnostic.message}`
      if (reportedDiagnostics.current.has(key)) continue
      reportedDiagnostics.current.add(key)
      config.onError?.(diagnostic)
    }
  }, [config, model.diagnostics])

  return model
}
