import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { useStore } from "zustand"
import { CalendarConfigContext } from "./calendar-config-context.js"
import { CalendarContext } from "./calendar-context.js"
import { createCalendarStore } from "../store/create-store.js"
import type { CalendarConfig } from "../types.js"
import {
  getCalendarDateInTimeZone,
  isCalendarDate,
} from "../utils/date-engine.js"
import { normalizeCalendarItems } from "../utils/normalize-items.js"
import {
  getCalendarVisibleRange,
  normalizeCalendarSources,
  canMutateCalendarItem,
} from "../utils/data-integration.js"
import {
  calendarRangesEqual,
  getCalendarItemRange,
} from "../utils/date-range.js"

export interface CalendarProviderProps {
  readonly config: CalendarConfig
  readonly children: ReactNode
}

/**
 * Creates one isolated client-state store while keeping authoritative items,
 * server preferences, renderers, and callbacks in configuration context.
 */
export function CalendarProvider({ config, children }: CalendarProviderProps) {
  const {
    initialAnchorDate,
    items,
    maxSpanDays,
    onInvalidItem,
    onMutationRejected,
    preferences,
  } = config
  const [store] = useState(() => {
    const now = config.now?.() ?? new Date()
    const resolvedInitialAnchorDate = isCalendarDate(config.anchorDate)
      ? config.anchorDate
      : isCalendarDate(initialAnchorDate)
        ? initialAnchorDate
        : getCalendarDateInTimeZone(now, config.preferences.timeZone)

    return createCalendarStore({ initialAnchorDate: resolvedInitialAnchorDate })
  })
  const anchorDate = useStore(store, (state) => state.anchorDate)
  const visibleRange = useMemo(
    () => getCalendarVisibleRange(anchorDate, preferences),
    [anchorDate, preferences]
  )
  const normalizedItems = useMemo(
    () =>
      normalizeCalendarItems(items, {
        timeZone: preferences.timeZone,
        maxSpanDays,
      }),
    [items, maxSpanDays, preferences.timeZone]
  )
  const authoritativeItems = useMemo(
    () => normalizedItems.items.map(({ item }) => item),
    [normalizedItems.items]
  )
  const previousAuthoritativeItemsRef = useRef(
    new Map(authoritativeItems.map((item) => [item.id, item]))
  )

  useEffect(() => {
    if (isCalendarDate(config.anchorDate)) {
      store.getState().actions.setAnchorDate(config.anchorDate)
    }
  }, [config.anchorDate, store])

  useEffect(() => {
    const dataCanReconcile =
      !config.dataState ||
      (config.dataState.rangeKey === visibleRange.key &&
        config.dataState.status !== "loading" &&
        (config.dataState.status !== "error" || config.dataState.hasUsableData))
    if (!dataCanReconcile) return
    const actions = store.getState().actions
    const previousInteraction = store.getState().interaction
    const nextItems = new Map(authoritativeItems.map((item) => [item.id, item]))
    const activeItemIds =
      previousInteraction.type === "moving"
        ? previousInteraction.itemIds
        : previousInteraction.type === "resizing"
          ? [previousInteraction.itemId]
          : []
    const liveConflict = activeItemIds.some((itemId) => {
      const previousItem = previousAuthoritativeItemsRef.current.get(itemId)
      const nextItem = nextItems.get(itemId)
      return (
        !previousItem ||
        !nextItem ||
        !calendarRangesEqual(
          getCalendarItemRange(previousItem),
          getCalendarItemRange(nextItem)
        ) ||
        !canMutateCalendarItem(config, nextItem, "update")
      )
    })
    previousAuthoritativeItemsRef.current = nextItems
    if (liveConflict) {
      actions.cancelInteraction()
      actions.announce(
        "Calendar interaction cancelled because the event changed remotely."
      )
    }
    actions.reconcileItemIds(new Set(authoritativeItems.map(({ id }) => id)))
    if (
      !liveConflict &&
      previousInteraction.type !== "idle" &&
      store.getState().interaction.type === "idle"
    ) {
      actions.announce(
        "Calendar interaction cancelled because authoritative data changed."
      )
    }
    const rejections = actions.reconcileAuthoritativeItems(
      authoritativeItems,
      config.dataMode !== "visible-range"
    )
    for (const rejection of rejections) {
      onMutationRejected?.(rejection)
    }
    if (rejections.length > 0) {
      actions.announce(
        `${rejections.length} pending calendar change${rejections.length === 1 ? " was" : "s were"} rejected by authoritative data.`
      )
    }
  }, [authoritativeItems, config, onMutationRejected, store, visibleRange.key])

  useEffect(() => {
    const configuredSources =
      config.sources ??
      (config.agenda?.sidebar?.type === "default"
        ? config.agenda.sidebar.calendars
        : [])
    const { invalidIds } = normalizeCalendarSources(configuredSources)
    if (invalidIds.length > 0 && import.meta.env.DEV) {
      console.warn(
        `[Calendar] ${invalidIds.length} calendar source ID${invalidIds.length === 1 ? " is" : "s are"} empty or duplicated; later duplicates are ignored.`,
        invalidIds
      )
    }
  }, [config.agenda?.sidebar, config.sources])

  useEffect(() => {
    for (const issue of normalizedItems.invalidItems) {
      onInvalidItem?.(issue)
      if (import.meta.env.DEV) {
        console.warn(`[Calendar] ${issue.message}`, issue.item)
      }
    }
    if (normalizedItems.invalidItems.length > 0) {
      store
        .getState()
        .actions.announce(
          `${normalizedItems.invalidItems.length} invalid calendar item${normalizedItems.invalidItems.length === 1 ? " was" : "s were"} not displayed.`
        )
    }
  }, [normalizedItems.invalidItems, onInvalidItem, store])

  useEffect(() => {
    if (
      initialAnchorDate !== undefined &&
      !isCalendarDate(initialAnchorDate) &&
      import.meta.env.DEV
    ) {
      console.warn(
        `[Calendar] initialAnchorDate "${initialAnchorDate}" is invalid; using today instead.`
      )
    }
  }, [initialAnchorDate])

  return (
    <CalendarConfigContext.Provider value={config}>
      <CalendarContext.Provider value={store}>
        {children}
      </CalendarContext.Provider>
    </CalendarConfigContext.Provider>
  )
}
