import { createContext } from "react"
import type { DataListStore } from "../store/create-store.js"

export const DataListContext = createContext<DataListStore | null>(null)
