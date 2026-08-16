import type { StoreApi } from "zustand/vanilla"
import type { CalendarState } from "../types.js"

export type CalendarStoreSet = StoreApi<CalendarState>["setState"]
export type CalendarStoreGet = StoreApi<CalendarState>["getState"]

export interface CalendarStoreSlice<TState, TActions> {
  readonly state: TState
  readonly actions: TActions
}
