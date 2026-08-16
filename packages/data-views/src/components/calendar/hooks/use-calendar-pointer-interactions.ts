import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react"
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
import type { CalendarDateGrid } from "../utils/date-grid.js"
import { differenceInCalendarDays } from "../utils/date-engine.js"
import { getCalendarItemRange } from "../utils/date-range.js"
import {
  createAllDayRange,
  resizeCalendarRangeToDate,
  shiftCalendarRangeByDays,
} from "../utils/mutations.js"
import { getColumnIndexAtX } from "../utils/position.js"
import {
  canCreateCalendarItem,
  canMutateCalendarItem,
} from "../utils/data-integration.js"

const DRAG_THRESHOLD_PX = 4
const EDGE_ZONE_PX = 48
const EDGE_NAVIGATION_DELAY_MS = 550

type PointerMode =
  | { readonly type: "move"; readonly itemIds: readonly string[] }
  | {
      readonly type: "resize"
      readonly itemId: string
      readonly edge: "start" | "end"
    }
  | { readonly type: "create" }

interface PointerSession {
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
  readonly originDate: CalendarDate
  readonly mode: PointerMode
  readonly previousRanges: ReadonlyMap<string, CalendarRange>
  started: boolean
}

export interface CalendarPointerInteractions {
  readonly beginItem: (
    event: React.PointerEvent<HTMLElement>,
    item: CalendarItem,
    date: CalendarDate
  ) => void
  readonly beginResize: (
    event: React.PointerEvent<HTMLElement>,
    item: CalendarItem,
    edge: "start" | "end",
    date: CalendarDate
  ) => void
  readonly beginCreate: (
    event: React.PointerEvent<HTMLElement>,
    date: CalendarDate
  ) => void
  readonly onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  readonly onPointerUp: (event: React.PointerEvent<HTMLElement>) => void
  readonly onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void
}

function dateAtPoint(
  gridElement: HTMLElement | null,
  grid: CalendarDateGrid,
  clientX: number,
  clientY: number
): CalendarDate | null {
  if (!gridElement) return null
  const rect = gridElement.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const rowIndex = Math.min(
    grid.rows.length - 1,
    Math.max(
      0,
      Math.floor(((clientY - rect.top) / rect.height) * grid.rows.length)
    )
  )
  const row = grid.rows[rowIndex]
  const columnIndex = getColumnIndexAtX(
    clientX,
    rect.left,
    rect.width,
    row.visibleCells.length
  )
  return row.visibleCells[columnIndex]?.date ?? null
}

export function useCalendarPointerInteractions(
  gridRef: React.RefObject<HTMLDivElement | null>,
  grid: CalendarDateGrid,
  items: readonly CalendarItem[]
): CalendarPointerInteractions {
  const config = useCalendarConfig()
  const store = useCalendarStoreApi()
  const commands = useCalendarCommandActions()
  const navigation = useCalendarNavigationActions()
  const session = useRef<PointerSession | null>(null)
  const frame = useRef<number | null>(null)
  const latestPoint = useRef<{ x: number; y: number } | null>(null)
  const edgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const edgeDirection = useRef<"previous" | "next" | null>(null)
  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  )
  const latestGrid = useRef(grid)
  const latestItemMap = useRef(itemMap)
  useLayoutEffect(() => {
    latestGrid.current = grid
    latestItemMap.current = itemMap
  }, [grid, itemMap])

  const clearEdgeTimer = useCallback(() => {
    if (edgeTimer.current) clearTimeout(edgeTimer.current)
    edgeTimer.current = null
    edgeDirection.current = null
  }, [])

  const cancel = useCallback(() => {
    session.current = null
    latestPoint.current = null
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    clearEdgeTimer()
    store.getState().actions.cancelInteraction()
  }, [clearEdgeTimer, store])

  useEffect(() => cancel, [cancel])

  const updateEdgeNavigation = useCallback(
    (clientX: number) => {
      const rect = gridRef.current?.getBoundingClientRect()
      const direction = rect
        ? clientX - rect.left <= EDGE_ZONE_PX
          ? "previous"
          : rect.right - clientX <= EDGE_ZONE_PX
            ? "next"
            : null
        : null
      if (direction === edgeDirection.current) return
      clearEdgeTimer()
      if (!direction) return
      edgeDirection.current = direction
      edgeTimer.current = setTimeout(() => {
        if (direction === "previous") navigation.previous()
        else navigation.next()
        edgeTimer.current = null
        edgeDirection.current = null
      }, EDGE_NAVIGATION_DELAY_MS)
    },
    [clearEdgeTimer, gridRef, navigation]
  )

  const previewAt = useCallback(
    (clientX: number, clientY: number) => {
      const active = session.current
      if (!active) return
      const date = dateAtPoint(
        gridRef.current,
        latestGrid.current,
        clientX,
        clientY
      )
      if (!date) return
      const actions = store.getState().actions
      if (!active.started) {
        const distance = Math.hypot(
          clientX - active.clientX,
          clientY - active.clientY
        )
        if (distance < DRAG_THRESHOLD_PX) return
        active.started = true
        if (active.mode.type === "move") {
          const preview = active.mode.itemIds.flatMap((itemId) => {
            const previousRange = active.previousRanges.get(itemId)
            if (!previousRange) return []
            return [{ itemId, previousRange, nextRange: previousRange }]
          })
          actions.startMoving({
            type: "moving",
            itemIds: active.mode.itemIds,
            origin: {
              pointerId: active.pointerId,
              clientX: active.clientX,
              clientY: active.clientY,
              date: active.originDate,
            },
            preview,
          })
        } else if (active.mode.type === "resize") {
          const item = latestItemMap.current.get(active.mode.itemId)
          const previousRange = active.previousRanges.get(active.mode.itemId)
          if (!item || !previousRange) return
          actions.startResizing({
            type: "resizing",
            itemId: item.id,
            edge: active.mode.edge,
            origin: {
              pointerId: active.pointerId,
              clientX: active.clientX,
              clientY: active.clientY,
              date: active.originDate,
            },
            preview: previousRange,
          })
        } else {
          actions.startCreating({
            type: "creating",
            origin: {
              pointerId: active.pointerId,
              clientX: active.clientX,
              clientY: active.clientY,
              date: active.originDate,
            },
            preview: createAllDayRange(active.originDate, date),
          })
        }
      }

      if (active.mode.type === "move") {
        const days = differenceInCalendarDays(date, active.originDate)
        const preview: CalendarItemRangeChange[] = active.mode.itemIds.flatMap(
          (itemId) => {
            const previousRange = active.previousRanges.get(itemId)
            if (!previousRange) return []
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
          }
        )
        actions.updateMovePreview(preview)
      } else if (active.mode.type === "resize") {
        const previousRange = active.previousRanges.get(active.mode.itemId)
        if (previousRange) {
          actions.updateResizePreview(
            resizeCalendarRangeToDate(
              previousRange,
              active.mode.edge,
              date,
              config.preferences.timeZone
            )
          )
        }
      } else {
        actions.updateCreatePreview(createAllDayRange(active.originDate, date))
      }
      updateEdgeNavigation(clientX)
    },
    [config.preferences.timeZone, gridRef, store, updateEdgeNavigation]
  )

  const begin = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      date: CalendarDate,
      mode: PointerMode,
      previousRanges: ReadonlyMap<string, CalendarRange> = new Map()
    ) => {
      const permitted =
        mode.type === "create"
          ? canCreateCalendarItem(config)
          : mode.type === "move"
            ? mode.itemIds.every((itemId) => {
                const item = latestItemMap.current.get(itemId)
                return item && canMutateCalendarItem(config, item, "update")
              })
            : (() => {
                const item = latestItemMap.current.get(mode.itemId)
                return item && canMutateCalendarItem(config, item, "update")
              })()
      if (!permitted || event.button !== 0) return
      event.currentTarget.setPointerCapture?.(event.pointerId)
      session.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        originDate: date,
        mode,
        previousRanges,
        started: false,
      }
    },
    [config]
  )

  const emitCreate = useCallback(
    (range: CalendarRange) => {
      const created = commands.create(range, {
        viewMode: config.preferences.viewMode,
        source: "pointer",
      })
      if (!created) {
        store
          .getState()
          .actions.announce("Calendar item creation is unavailable.")
        return
      }
      const dates =
        range.kind === "all-day"
          ? range.startDate === range.endDate
            ? `on ${range.startDate}`
            : `from ${range.startDate} through ${range.endDate}`
          : "in the selected time range"
      store.getState().actions.announce(`Create calendar item ${dates}.`)
    },
    [commands, config.preferences.viewMode, store]
  )

  const beginItem = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      item: CalendarItem,
      date: CalendarDate
    ) => {
      event.stopPropagation()
      const selected = store.getState().selectedIds
      const itemIds = selected.has(item.id) ? [...selected] : [item.id]
      begin(
        event,
        date,
        { type: "move", itemIds },
        new Map(
          itemIds.flatMap((itemId) => {
            const selectedItem = latestItemMap.current.get(itemId)
            return selectedItem
              ? [[itemId, getCalendarItemRange(selectedItem)] as const]
              : []
          })
        )
      )
    },
    [begin, store]
  )

  const beginResize = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      item: CalendarItem,
      edge: "start" | "end",
      date: CalendarDate
    ) => {
      event.preventDefault()
      event.stopPropagation()
      begin(
        event,
        date,
        { type: "resize", itemId: item.id, edge },
        new Map([[item.id, getCalendarItemRange(item)]])
      )
    },
    [begin]
  )

  const beginCreate = useCallback(
    (event: React.PointerEvent<HTMLElement>, date: CalendarDate) =>
      begin(event, date, { type: "create" }),
    [begin]
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!session.current || event.pointerId !== session.current.pointerId)
        return
      latestPoint.current = { x: event.clientX, y: event.clientY }
      if (frame.current !== null) return
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        const point = latestPoint.current
        if (point) previewAt(point.x, point.y)
      })
    },
    [previewAt]
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const active = session.current
      if (!active || event.pointerId !== active.pointerId) return
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current)
        frame.current = null
      }
      previewAt(event.clientX, event.clientY)
      const interaction = store.getState().actions.finishInteraction()
      session.current = null
      latestPoint.current = null
      clearEdgeTimer()
      if (!interaction) {
        if (active.mode.type === "create") {
          emitCreate(createAllDayRange(active.originDate, active.originDate))
        }
        return
      }
      if (interaction.type === "moving") {
        const changes = interaction.preview.filter((change) => {
          const before = change.previousRange
          const after = change.nextRange
          return before.kind === "all-day" && after.kind === "all-day"
            ? before.startDate !== after.startDate ||
                before.endDate !== after.endDate
            : before.kind === "timed" && after.kind === "timed"
              ? before.start.getTime() !== after.start.getTime() ||
                before.end.getTime() !== after.end.getTime()
              : false
        })
        if (changes.length > 0) {
          commands.commit({
            type: "move",
            clientMutationId: commands.nextMutationId("move"),
            changes,
          })
        }
      } else if (interaction.type === "resizing") {
        const item = latestItemMap.current.get(interaction.itemId)
        const previousRange = active.previousRanges.get(interaction.itemId)
        if (item && previousRange) {
          const nextRange: CalendarRange = interaction.preview
          commands.commit({
            type: "resize",
            clientMutationId: commands.nextMutationId("resize"),
            itemId: item.id,
            edge: interaction.edge,
            previousRange,
            nextRange,
          })
        }
      } else {
        emitCreate(interaction.preview)
      }
    },
    [clearEdgeTimer, commands, emitCreate, previewAt, store]
  )

  const onPointerCancel = useCallback(() => cancel(), [cancel])

  return useMemo(
    () => ({
      beginItem,
      beginResize,
      beginCreate,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    }),
    [
      beginCreate,
      beginItem,
      beginResize,
      onPointerCancel,
      onPointerMove,
      onPointerUp,
    ]
  )
}
