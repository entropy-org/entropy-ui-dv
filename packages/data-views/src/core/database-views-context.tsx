"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { DataViewController } from "./types.js"

const DatabaseViewsContext = createContext<DataViewController<unknown> | null>(
  null
)

export interface DatabaseViewsContextProviderProps<TRecord> {
  readonly value: DataViewController<TRecord>
  readonly children: ReactNode
}

export function DatabaseViewsContextProvider<TRecord>({
  value,
  children,
}: DatabaseViewsContextProviderProps<TRecord>) {
  return (
    <DatabaseViewsContext.Provider
      value={value as unknown as DataViewController<unknown>}
    >
      {children}
    </DatabaseViewsContext.Provider>
  )
}

export function useDatabaseViews<TRecord = unknown>() {
  const value = useContext(DatabaseViewsContext)
  if (!value) {
    throw new Error("useDatabaseViews must be used within DatabaseViews.")
  }
  return value as unknown as DataViewController<TRecord>
}
