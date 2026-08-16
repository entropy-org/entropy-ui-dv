import { render, renderHook, type RenderResult } from "@testing-library/react"
import type { ReactNode } from "react"
import { CalendarConfigContext } from "../context/calendar-config-context.js"
import { CalendarContext } from "../context/calendar-context.js"
import {
  createCalendarStore,
  type CalendarStore,
  type CreateCalendarStoreOptions,
} from "../store/create-store.js"
import type { CalendarConfig } from "../types.js"
import {
  createTestConfig,
  TEST_ANCHOR_DATE,
} from "./fixtures.js"

export interface RenderCalendarResult {
  renderResult: RenderResult
  store: CalendarStore
  config: CalendarConfig
}

export function renderCalendar(
  ui: ReactNode,
  storeOptions: CreateCalendarStoreOptions = {
    initialAnchorDate: TEST_ANCHOR_DATE,
  },
  configOverrides: Partial<CalendarConfig> = {}
): RenderCalendarResult {
  const store = createCalendarStore(storeOptions)
  const config = createTestConfig(configOverrides)
  const renderResult = render(
    <CalendarConfigContext.Provider value={config}>
      <CalendarContext.Provider value={store}>{ui}</CalendarContext.Provider>
    </CalendarConfigContext.Provider>
  )

  return { renderResult, store, config }
}

export function renderCalendarHook<T>(
  hook: () => T,
  storeOptions: CreateCalendarStoreOptions = {
    initialAnchorDate: TEST_ANCHOR_DATE,
  },
  configOverrides: Partial<CalendarConfig> = {}
) {
  const store = createCalendarStore(storeOptions)
  const config = createTestConfig(configOverrides)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CalendarConfigContext.Provider value={config}>
      <CalendarContext.Provider value={store}>
        {children}
      </CalendarContext.Provider>
    </CalendarConfigContext.Provider>
  )

  return { ...renderHook(hook, { wrapper }), store, config }
}
