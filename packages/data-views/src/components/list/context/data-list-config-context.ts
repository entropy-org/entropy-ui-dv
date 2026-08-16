import { createContext, useContext } from "react"
import type { DataListConfig } from "../types.js"

export const DataListConfigContext =
  createContext<DataListConfig<unknown> | null>(null)

export function useDataListConfig<TData>(): DataListConfig<TData> {
  const config = useContext(DataListConfigContext)
  if (!config) {
    throw new Error(
      "useDataListConfig must be used within a <DataListProvider>"
    )
  }
  return config as DataListConfig<TData>
}
