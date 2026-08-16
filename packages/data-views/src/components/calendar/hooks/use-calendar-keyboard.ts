import { useCallback, useMemo, type RefObject } from "react"
import { useCalendarConfig } from "../context/calendar-config-context.js"
import { useCalendarStoreApi } from "../context/calendar-context.js"
import { useCalendarCommandActions } from "./use-calendar-command-actions.js"
import { useCalendarNavigationActions } from "./use-calendar-navigation.js"
import { useCalendarPreferencesChange } from "./use-calendar-preferences.js"
import type { CalendarRenderModel } from "../utils/calendar-model.js"
import {
  addCalendarDays,
  getDayOfWeek,
} from "../utils/date-engine.js"
import { getCalendarItemRange } from "../utils/date-range.js"
import {
  resizeCalendarRangeToDate,
  shiftCalendarRangeByDays,
} from "../utils/mutations.js"
import { agendaWallClockToInstant } from "../utils/agenda.js"

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.matches(
      "input, textarea, select, [role='textbox'], [role='searchbox']"
    )
  )
}

export function useCalendarKeyboard(
  model: CalendarRenderModel,
  rootRef?: RefObject<HTMLElement | null>
) {
  const config = useCalendarConfig()
  const store = useCalendarStoreApi()
  const commands = useCalendarCommandActions()
  const navigation = useCalendarNavigationActions()
  const changePreferences = useCalendarPreferencesChange()
  const selectionEnabled = config.selection?.mode !== "none"
  const itemMap = useMemo(
    () => new Map(model.items.map((item) => [item.id, item])),
    [model.items]
  )

  const focusDate = useCallback(
    (date: string) => {
      requestAnimationFrame(() => {
        rootRef?.current
          ?.querySelector<HTMLElement>(`[data-calendar-date="${date}"]`)
          ?.focus({ preventScroll: true })
      })
    },
    [rootRef]
  )

  const moveFocus = useCallback(
    (days: number) => {
      const state = store.getState()
      let date = addCalendarDays(state.focusedDate ?? state.anchorDate, days)
      if (!config.preferences.showWeekends) {
        while (getDayOfWeek(date) === 0 || getDayOfWeek(date) === 6) {
          date = addCalendarDays(date, days < 0 ? -1 : 1)
        }
      }
      state.actions.setFocusedDate(date)
      if (date < model.grid.startDate || date > model.grid.endDate) {
        navigation.toDate(date)
      }
      focusDate(date)
    },
    [
      config.preferences.showWeekends,
      focusDate,
      model.grid.endDate,
      model.grid.startDate,
      navigation,
      store,
    ]
  )

  const moveSelected = useCallback(
    (days: number) => {
      if (config.readOnly) return
      const selectedIds = [...store.getState().selectedIds]
      const changes = selectedIds.flatMap((itemId) => {
        const item = itemMap.get(itemId)
        if (!item) return []
        const previousRange = getCalendarItemRange(item)
        return [
          {
            itemId,
            previousRange,
            nextRange: shiftCalendarRangeByDays(
              previousRange,
              days,
              config.preferences.timeZone
            ),
          },
        ]
      })
      if (changes.length > 0) {
        commands.commit({
          type: "move",
          clientMutationId: commands.nextMutationId("keyboard-move"),
          changes,
        })
      }
    },
    [commands, config.preferences.timeZone, config.readOnly, itemMap, store]
  )

  const resizeSelected = useCallback(
    (edge: "start" | "end", days: number) => {
      if (config.readOnly) return
      const itemId = [...store.getState().selectedIds][0]
      const item = itemId ? itemMap.get(itemId) : undefined
      const normalized = itemId
        ? model.normalized.items.find(
            (candidate) => candidate.item.id === itemId
          )
        : undefined
      if (!item || !normalized) return
      const previousRange = getCalendarItemRange(item)
      const boundaryDate =
        edge === "start"
          ? normalized.dateSpan.startDate
          : normalized.dateSpan.endDate
      const nextRange = resizeCalendarRangeToDate(
        previousRange,
        edge,
        addCalendarDays(boundaryDate, days),
        config.preferences.timeZone
      )
      commands.commit({
        type: "resize",
        clientMutationId: commands.nextMutationId("keyboard-resize"),
        itemId: item.id,
        edge,
        previousRange,
        nextRange,
      })
    },
    [
      commands,
      config.preferences.timeZone,
      config.readOnly,
      itemMap,
      model.normalized.items,
      store,
    ]
  )

  return useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (isTextEntry(event.target)) return
      const modifier = event.ctrlKey || event.metaKey
      const actions = store.getState().actions
      const key = event.key.toLowerCase()

      if (modifier && key === "a") {
        event.preventDefault()
        if (selectionEnabled) {
          actions.selectVisible(model.orderedItemIds)
          actions.announce(
            `${model.orderedItemIds.length} visible calendar item${model.orderedItemIds.length === 1 ? "" : "s"} selected.`
          )
        }
        return
      }
      if (modifier && key === "z") {
        event.preventDefault()
        if (event.shiftKey) commands.redo()
        else commands.undo()
        return
      }
      if (modifier && key === "y") {
        event.preventDefault()
        commands.redo()
        return
      }
      if (selectionEnabled && modifier && key === "d" && !config.readOnly) {
        event.preventDefault()
        const selected = [...store.getState().selectedIds]
          .map((itemId) => itemMap.get(itemId))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
        if (commands.duplicate(selected)) {
          actions.announce(
            `Duplicate ${selected.length} calendar item${selected.length === 1 ? "" : "s"}.`
          )
        } else {
          actions.announce("Select an item to duplicate.")
        }
        return
      }
      if (
        selectionEnabled &&
        event.shiftKey &&
        key === "c" &&
        !config.readOnly &&
        config.preferences.viewMode === "agenda"
      ) {
        event.preventDefault()
        const itemId = [...store.getState().selectedIds][0]
        const item = itemId ? itemMap.get(itemId) : undefined
        const normalized = itemId
          ? model.normalized.items.find(
              (candidate) => candidate.item.id === itemId
            )
          : undefined
        if (!item || !normalized) {
          actions.announce("Select one item to convert.")
          return
        }
        const nextRange =
          item.kind === "timed"
            ? {
                kind: "all-day" as const,
                startDate: normalized.dateSpan.startDate,
                endDate: normalized.dateSpan.endDate,
              }
            : {
                kind: "timed" as const,
                start: agendaWallClockToInstant(
                  item.startDate,
                  config.preferences.agenda.workingHours.startMinutes,
                  config.preferences.timeZone
                ),
                end: agendaWallClockToInstant(
                  item.startDate,
                  config.preferences.agenda.workingHours.startMinutes +
                    (config.agenda?.defaultTimedDurationMinutes ?? 30),
                  config.preferences.timeZone
                ),
              }
        if (commands.convert(item, nextRange)) {
          actions.announce(`Conversion requested for ${item.id}.`)
        } else actions.announce(`Conversion is unavailable for ${item.id}.`)
        return
      }
      if (
        selectionEnabled &&
        event.altKey &&
        event.shiftKey &&
        (event.key === "ArrowLeft" || event.key === "ArrowRight")
      ) {
        event.preventDefault()
        if (event.key === "ArrowLeft") resizeSelected("start", -1)
        else resizeSelected("end", 1)
        return
      }
      if (
        event.altKey &&
        (event.key === "ArrowLeft" || event.key === "ArrowRight")
      ) {
        event.preventDefault()
        moveSelected(event.key === "ArrowLeft" ? -1 : 1)
        return
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault()
        moveFocus(event.key === "ArrowLeft" ? -1 : 1)
        return
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault()
        moveFocus(event.key === "ArrowUp" ? -7 : 7)
        return
      }
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault()
        const current =
          store.getState().focusedDate ?? store.getState().anchorDate
        const weekStartOffset =
          (getDayOfWeek(current) - config.preferences.weekStartsOn + 7) % 7
        const start = addCalendarDays(current, -weekStartOffset)
        let target = event.key === "Home" ? start : addCalendarDays(start, 6)
        if (!config.preferences.showWeekends) {
          target =
            event.key === "Home"
              ? addCalendarDays(start, getDayOfWeek(start) === 0 ? 1 : 0)
              : addCalendarDays(start, 5)
        }
        actions.setFocusedDate(target)
        focusDate(target)
        return
      }
      if (event.key === "PageUp" || event.key === "PageDown") {
        event.preventDefault()
        if (event.key === "PageUp") navigation.previous()
        else navigation.next()
        return
      }
      if (key === "t") {
        event.preventDefault()
        navigation.today()
        return
      }
      if (key === "m" || key === "w" || key === "a") {
        event.preventDefault()
        changePreferences({
          type: "view-mode",
          value: key === "m" ? "month" : key === "w" ? "week" : "agenda",
        })
        actions.announce(
          `${key === "m" ? "Month" : key === "w" ? "Week" : "Agenda"} view requested.`
        )
        return
      }
      if (
        (event.key === "Enter" || event.key === " ") &&
        !config.readOnly &&
        config.preferences.viewMode !== "agenda"
      ) {
        const date = store.getState().focusedDate
        if (date) {
          event.preventDefault()
          commands.create(
            { kind: "all-day", startDate: date, endDate: date },
            { viewMode: config.preferences.viewMode, source: "keyboard" }
          )
          actions.announce(`Create calendar item on ${date}.`)
        }
        return
      }
      if (
        selectionEnabled &&
        (event.key === "Delete" || event.key === "Backspace") &&
        !config.readOnly
      ) {
        event.preventDefault()
        commands.deleteSelected()
        return
      }
      if (event.key === "Escape") {
        if (actions.cancelInteraction()) {
          event.preventDefault()
          actions.announce("Calendar interaction cancelled.")
        } else if (store.getState().overflow.type === "open") {
          event.preventDefault()
          actions.closeOverflow()
          actions.announce("Overflow events closed.")
        } else if (selectionEnabled && store.getState().selectedIds.size > 0) {
          event.preventDefault()
          actions.clearSelection()
          actions.announce("Calendar selection cleared.")
        }
      }
    },
    [
      changePreferences,
      commands,
      config,
      focusDate,
      itemMap,
      model.normalized.items,
      model.orderedItemIds,
      moveFocus,
      moveSelected,
      resizeSelected,
      navigation,
      selectionEnabled,
      store,
    ]
  )
}
