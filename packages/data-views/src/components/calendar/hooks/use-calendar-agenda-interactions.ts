import { useCallback, useEffect, useMemo, useRef } from "react"
import { useCalendarConfig } from "../context/calendar-config-context.js"
import { useCalendarStoreApi } from "../context/calendar-context.js"
import { useCalendarCommandActions } from "./use-calendar-command-actions.js"
import { useCalendarNavigationActions } from "./use-calendar-navigation.js"
import type {
  CalendarDate,
  CalendarItem,
  CalendarItemRangeChange,
  CalendarRange,
} from "../types.js"
import {
  agendaWallClockToInstant,
  shiftTimedRangeByWallClock,
  snapAgendaMinutes,
} from "../utils/agenda.js"
import { differenceInCalendarDays } from "../utils/date-engine.js"
import { getCalendarItemRange } from "../utils/date-range.js"
import {
  resizeCalendarRangeToDate,
  shiftCalendarRangeByDays,
} from "../utils/mutations.js"
import {
  canCreateCalendarItem,
  canMutateCalendarItem,
} from "../utils/data-integration.js"

const DRAG_THRESHOLD = 4
const HORIZONTAL_EDGE_PX = 40
const HORIZONTAL_EDGE_DWELL_MS = 550

type AgendaPointerMode =
  | { readonly type: "create"; readonly allDay: boolean }
  | {
      readonly type: "move"
      readonly itemIds: readonly string[]
      readonly allDay: boolean
    }
  | {
      readonly type: "resize"
      readonly itemId: string
      readonly edge: "start" | "end"
      readonly allDay: boolean
    }

interface AgendaPointerSession {
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
  readonly originDate: CalendarDate
  readonly originMinutes: number
  readonly mode: AgendaPointerMode
  readonly previousRanges: ReadonlyMap<string, CalendarRange>
  started: boolean
}

export interface CalendarAgendaInteractions {
  readonly beginCreate: (
    event: React.PointerEvent<HTMLElement>,
    allDay?: boolean
  ) => void
  readonly beginMove: (
    event: React.PointerEvent<HTMLElement>,
    item: CalendarItem,
    allDay?: boolean
  ) => void
  readonly beginResize: (
    event: React.PointerEvent<HTMLElement>,
    item: CalendarItem,
    edge: "start" | "end",
    allDay?: boolean
  ) => void
  readonly onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  readonly onPointerUp: (event: React.PointerEvent<HTMLElement>) => void
  readonly onPointerCancel: () => void
}

export function useCalendarAgendaInteractions(
  canvasRef: React.RefObject<HTMLDivElement | null>,
  scrollRef: React.RefObject<HTMLDivElement | null>,
  dates: readonly CalendarDate[],
  items: readonly CalendarItem[]
): CalendarAgendaInteractions {
  const config = useCalendarConfig()
  const store = useCalendarStoreApi()
  const commands = useCalendarCommandActions()
  const navigation = useCalendarNavigationActions()
  const session = useRef<AgendaPointerSession | null>(null)
  const frame = useRef<number | null>(null)
  const edgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const edgeDirection = useRef<"previous" | "next" | null>(null)
  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  )
  const agenda = config.preferences.agenda
  const hourHeight = Math.max(32, Math.min(240, agenda.hourHeight))

  const point = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return null
      const index = Math.max(
        0,
        Math.min(
          dates.length - 1,
          Math.floor(((clientX - rect.left) / rect.width) * dates.length)
        )
      )
      return {
        date: dates[index],
        minutes: snapAgendaMinutes(
          ((clientY - rect.top) / hourHeight) * 60,
          agenda.snapMinutes
        ),
      }
    },
    [agenda.snapMinutes, canvasRef, dates, hourHeight]
  )

  const clearEdgeNavigation = useCallback(() => {
    if (edgeTimer.current) clearTimeout(edgeTimer.current)
    edgeTimer.current = null
    edgeDirection.current = null
  }, [])

  const updateEdgeNavigation = useCallback(
    (clientX: number) => {
      const canvasRect = canvasRef.current?.getBoundingClientRect()
      const direction = canvasRect
        ? clientX - canvasRect.left <= HORIZONTAL_EDGE_PX
          ? "previous"
          : canvasRect.right - clientX <= HORIZONTAL_EDGE_PX
            ? "next"
            : null
        : null

      if (direction === edgeDirection.current) return

      clearEdgeNavigation()
      if (!direction) return

      edgeDirection.current = direction
      edgeTimer.current = setTimeout(() => {
        if (!session.current || edgeDirection.current !== direction) return
        if (direction === "previous") navigation.previous()
        else navigation.next()
        edgeTimer.current = null
        edgeDirection.current = null
      }, HORIZONTAL_EDGE_DWELL_MS)
    },
    [canvasRef, clearEdgeNavigation, navigation]
  )

  const cancel = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    session.current = null
    clearEdgeNavigation()
    store.getState().actions.cancelInteraction()
  }, [clearEdgeNavigation, store])

  useEffect(() => cancel, [cancel])

  const begin = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      mode: AgendaPointerMode,
      previousRanges: ReadonlyMap<string, CalendarRange> = new Map()
    ) => {
      const permitted =
        mode.type === "create"
          ? canCreateCalendarItem(config)
          : mode.type === "move"
            ? mode.itemIds.every((itemId) => {
                const item = itemMap.get(itemId)
                return item && canMutateCalendarItem(config, item, "update")
              })
            : (() => {
                const item = itemMap.get(mode.itemId)
                return item && canMutateCalendarItem(config, item, "update")
              })()
      if (!permitted || event.button !== 0) return
      const value = point(event.clientX, event.clientY)
      if (!value) return
      event.currentTarget.setPointerCapture?.(event.pointerId)
      session.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        originDate: value.date,
        originMinutes: value.minutes,
        mode,
        previousRanges,
        started: false,
      }
    },
    [config, itemMap, point]
  )

  const beginCreate = useCallback(
    (event: React.PointerEvent<HTMLElement>, allDay = false) => {
      if (event.target !== event.currentTarget) return
      begin(event, { type: "create", allDay })
    },
    [begin]
  )

  const beginMove = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      item: CalendarItem,
      allDay = false
    ) => {
      event.stopPropagation()
      const selected = store.getState().selectedIds
      const itemIds = selected.has(item.id) ? [...selected] : [item.id]
      begin(
        event,
        { type: "move", itemIds, allDay },
        new Map(
          itemIds.flatMap((id) => {
            const current = itemMap.get(id)
            return current ? [[id, getCalendarItemRange(current)] as const] : []
          })
        )
      )
    },
    [begin, itemMap, store]
  )

  const beginResize = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      item: CalendarItem,
      edge: "start" | "end",
      allDay = false
    ) => {
      event.preventDefault()
      event.stopPropagation()
      begin(
        event,
        { type: "resize", itemId: item.id, edge, allDay },
        new Map([[item.id, getCalendarItemRange(item)]])
      )
    },
    [begin]
  )

  const update = useCallback(
    (clientX: number, clientY: number) => {
      const active = session.current
      if (!active) return
      const next = point(clientX, clientY)
      if (!next) return
      const actions = store.getState().actions
      const dayDelta = differenceInCalendarDays(next.date, active.originDate)
      const minuteDelta = next.minutes - active.originMinutes
      if (!active.started) {
        if (
          Math.hypot(clientX - active.clientX, clientY - active.clientY) <
          DRAG_THRESHOLD
        )
          return
        active.started = true
        if (active.mode.type === "create") {
          const initial: CalendarRange = active.mode.allDay
            ? {
                kind: "all-day",
                startDate: active.originDate,
                endDate: active.originDate,
              }
            : {
                kind: "timed",
                start: agendaWallClockToInstant(
                  active.originDate,
                  active.originMinutes,
                  config.preferences.timeZone
                ),
                end: agendaWallClockToInstant(
                  active.originDate,
                  active.originMinutes +
                    (config.agenda?.defaultTimedDurationMinutes ?? 30),
                  config.preferences.timeZone
                ),
              }
          actions.startCreating({
            type: "creating",
            origin: {
              pointerId: active.pointerId,
              clientX: active.clientX,
              clientY: active.clientY,
              date: active.originDate,
            },
            preview: initial,
          })
        } else if (active.mode.type === "move") {
          actions.startMoving({
            type: "moving",
            itemIds: active.mode.itemIds,
            origin: {
              pointerId: active.pointerId,
              clientX: active.clientX,
              clientY: active.clientY,
              date: active.originDate,
            },
            preview: active.mode.itemIds.flatMap((itemId) => {
              const range = active.previousRanges.get(itemId)
              return range
                ? [{ itemId, previousRange: range, nextRange: range }]
                : []
            }),
          })
        } else {
          const range = active.previousRanges.get(active.mode.itemId)
          if (range)
            actions.startResizing({
              type: "resizing",
              itemId: active.mode.itemId,
              edge: active.mode.edge,
              origin: {
                pointerId: active.pointerId,
                clientX: active.clientX,
                clientY: active.clientY,
                date: active.originDate,
              },
              preview: range,
            })
        }
      }
      if (active.mode.type === "create") {
        if (active.mode.allDay) {
          actions.updateCreatePreview({
            kind: "all-day",
            startDate:
              next.date < active.originDate ? next.date : active.originDate,
            endDate:
              next.date > active.originDate ? next.date : active.originDate,
          })
        } else {
          const startValue = Math.min(active.originMinutes, next.minutes)
          const endValue = Math.max(
            active.originMinutes,
            next.minutes + agenda.snapMinutes
          )
          actions.updateCreatePreview({
            kind: "timed",
            start: agendaWallClockToInstant(
              next.date < active.originDate ? next.date : active.originDate,
              startValue,
              config.preferences.timeZone
            ),
            end: agendaWallClockToInstant(
              next.date > active.originDate ? next.date : active.originDate,
              endValue,
              config.preferences.timeZone
            ),
          })
        }
      } else if (active.mode.type === "move") {
        const preview: CalendarItemRangeChange[] = active.mode.itemIds.flatMap(
          (itemId) => {
            const previousRange = active.previousRanges.get(itemId)
            if (!previousRange) return []
            const nextRange =
              previousRange.kind === "timed" && !active.mode.allDay
                ? shiftTimedRangeByWallClock(
                    previousRange,
                    dayDelta,
                    minuteDelta,
                    config.preferences.timeZone
                  )
                : shiftCalendarRangeByDays(
                    previousRange,
                    dayDelta,
                    config.preferences.timeZone
                  )
            return [{ itemId, previousRange, nextRange }]
          }
        )
        actions.updateMovePreview(preview)
      } else {
        const previous = active.previousRanges.get(active.mode.itemId)
        if (!previous) return
        if (previous.kind === "all-day" || active.mode.allDay) {
          actions.updateResizePreview(
            resizeCalendarRangeToDate(
              previous,
              active.mode.edge,
              next.date,
              config.preferences.timeZone
            )
          )
        } else {
          const instant = agendaWallClockToInstant(
            next.date,
            next.minutes,
            config.preferences.timeZone
          )
          const minimum =
            (config.agenda?.minimumTimedDurationMinutes ?? agenda.snapMinutes) *
            60_000
          actions.updateResizePreview({
            kind: "timed",
            start:
              active.mode.edge === "start"
                ? new Date(
                    Math.min(
                      instant.getTime(),
                      previous.end.getTime() - minimum
                    )
                  )
                : previous.start,
            end:
              active.mode.edge === "end"
                ? new Date(
                    Math.max(
                      instant.getTime(),
                      previous.start.getTime() + minimum
                    )
                  )
                : previous.end,
          })
        }
      }
      const scroll = scrollRef.current
      if (scroll) {
        const rect = scroll.getBoundingClientRect()
        if (clientY - rect.top < 40) scroll.scrollTop -= 16
        else if (rect.bottom - clientY < 40) scroll.scrollTop += 16
      }
    },
    [
      agenda.snapMinutes,
      config.agenda,
      config.preferences.timeZone,
      point,
      scrollRef,
      store,
    ]
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!session.current || session.current.pointerId !== event.pointerId)
        return
      updateEdgeNavigation(event.clientX)
      if (frame.current !== null) return
      const { clientX, clientY } = event
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        update(clientX, clientY)
      })
    },
    [update, updateEdgeNavigation]
  )

  const emitCreate = useCallback(
    (range: CalendarRange) => {
      if (commands.create(range, { viewMode: "agenda", source: "pointer" })) {
        store
          .getState()
          .actions.announce(
            "Create calendar item in the selected agenda range."
          )
      } else {
        store
          .getState()
          .actions.announce("Calendar item creation is unavailable.")
      }
    },
    [commands, store]
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const active = session.current
      if (!active || active.pointerId !== event.pointerId) return
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current)
        frame.current = null
      }
      update(event.clientX, event.clientY)
      const interaction = store.getState().actions.finishInteraction()
      session.current = null
      clearEdgeNavigation()
      if (!interaction) {
        if (active.mode.type === "create") {
          emitCreate(
            active.mode.allDay
              ? {
                  kind: "all-day",
                  startDate: active.originDate,
                  endDate: active.originDate,
                }
              : {
                  kind: "timed",
                  start: agendaWallClockToInstant(
                    active.originDate,
                    active.originMinutes,
                    config.preferences.timeZone
                  ),
                  end: agendaWallClockToInstant(
                    active.originDate,
                    active.originMinutes +
                      (config.agenda?.defaultTimedDurationMinutes ?? 30),
                    config.preferences.timeZone
                  ),
                }
          )
        }
        return
      }
      if (interaction.type === "creating") emitCreate(interaction.preview)
      else if (interaction.type === "moving") {
        const changes = interaction.preview.filter(
          ({ previousRange, nextRange }) =>
            previousRange.kind === "all-day" && nextRange.kind === "all-day"
              ? previousRange.startDate !== nextRange.startDate ||
                previousRange.endDate !== nextRange.endDate
              : previousRange.kind === "timed" &&
                nextRange.kind === "timed" &&
                (previousRange.start.getTime() !== nextRange.start.getTime() ||
                  previousRange.end.getTime() !== nextRange.end.getTime())
        )
        if (changes.length)
          commands.commit({
            type: "move",
            clientMutationId: commands.nextMutationId("agenda-move"),
            changes,
          })
      } else {
        const previousRange = active.previousRanges.get(interaction.itemId)
        if (previousRange)
          commands.commit({
            type: "resize",
            clientMutationId: commands.nextMutationId("agenda-resize"),
            itemId: interaction.itemId,
            edge: interaction.edge,
            previousRange,
            nextRange: interaction.preview,
          })
      }
    },
    [clearEdgeNavigation, commands, config, emitCreate, store, update]
  )

  return useMemo(
    () => ({
      beginCreate,
      beginMove,
      beginResize,
      onPointerMove,
      onPointerUp,
      onPointerCancel: cancel,
    }),
    [beginCreate, beginMove, beginResize, cancel, onPointerMove, onPointerUp]
  )
}
