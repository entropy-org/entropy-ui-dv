import { useCallback, useContext, useEffect, useRef, useState } from "react"
import type { RefObject } from "react"
import type { TimelineItem } from "../types.js"
import { useTimelineStore } from "./use-timeline-store.js"
import { TimelineContext } from "../context/timeline-context.js"
import { TimelineConfigContext } from "../context/timeline-config-context.js"
import { useOptionalTimelineMutations } from "../context/timeline-mutation-context.js"
import {
  dateRangeToPxWidth,
  dateToPx,
  pxToDate,
} from "../utils/position-utils.js"
import { snapToGrid } from "../utils/snap-utils.js"

export interface UseDragOptions {
  item: TimelineItem
  origin: Date
  barRef: RefObject<HTMLElement | null>
}

export interface UseDragResult {
  isDragging: boolean
  handlePointerDown: (e: React.PointerEvent<Element> | PointerEvent) => void
  handlePointerMove: (e: React.PointerEvent<Element> | PointerEvent) => void
  handlePointerUp: (e: React.PointerEvent<Element> | PointerEvent) => void
  handleCancel: () => void
}

export function useDrag({
  item,
  origin,
  barRef,
}: UseDragOptions): UseDragResult {
  const viewportMode = useTimelineStore((s) => s.viewportMode)
  const snapEnabled = useTimelineStore((s) => s.snapToGrid)
  const readOnly = useTimelineStore((s) => s.readOnly)
  const activeDragState = useTimelineStore((s) => s.dragState)
  const updateItem = useTimelineStore((s) => s.actions.updateItem)
  const startDrag = useTimelineStore((s) => s.actions.startDrag)
  const endDrag = useTimelineStore((s) => s.actions.endDrag)
  const setRangeHighlight = useTimelineStore((s) => s.actions.setRangeHighlight)
  const clearRangeHighlight = useTimelineStore(
    (s) => s.actions.clearRangeHighlight
  )
  const store = useContext(TimelineContext)
  const mutationController = useOptionalTimelineMutations()
  const config = useContext(TimelineConfigContext)
  const getItemPermissions = config?.getItemPermissions
  const onInteractionCancel = config?.onInteractionCancel

  const [isDragging, setIsDragging] = useState(false)
  const originXRef = useRef(0)
  const currentClientXRef = useRef(0)
  const originScrollLeftRef = useRef(0)
  const previousOriginRef = useRef(origin)
  const rafIdRef = useRef<number | null>(null)
  const currentDeltaRef = useRef(0)
  const gestureItemRef = useRef<TimelineItem | null>(null)

  const calculateRange = useCallback(
    (targetItem: TimelineItem, deltaX: number) => {
      const shiftedStart = pxToDate(
        dateToPx(targetItem.startDate, origin, viewportMode) + deltaX,
        origin,
        viewportMode
      )
      const startDate = snapEnabled
        ? snapToGrid(shiftedStart, viewportMode)
        : shiftedStart
      const rangeWidth = dateRangeToPxWidth(
        targetItem.startDate,
        targetItem.endDate,
        viewportMode
      )
      const endDate = pxToDate(
        dateToPx(startDate, origin, viewportMode) + rangeWidth,
        origin,
        viewportMode
      )

      return { startDate, endDate }
    },
    [origin, snapEnabled, viewportMode]
  )

  const applyTransform = useCallback(
    (targetItem: TimelineItem, snappedStartDate: Date) => {
      if (!barRef.current) return
      const delta =
        dateToPx(snappedStartDate, origin, viewportMode) -
        dateToPx(targetItem.startDate, origin, viewportMode)
      const stableDelta = Math.round(delta * 1000) / 1000
      barRef.current.style.transform = `translate3d(${stableDelta}px, 0, 0)`
    },
    [barRef, origin, viewportMode]
  )

  const resetTransform = useCallback(() => {
    if (barRef.current) barRef.current.style.transform = ""
  }, [barRef])

  const updatePreview = useCallback(
    (clientX: number) => {
      const currentScrollLeft =
        store?.getState().scrollLeft ?? originScrollLeftRef.current
      currentDeltaRef.current =
        clientX -
        originXRef.current +
        currentScrollLeft -
        originScrollLeftRef.current
      const range = calculateRange(item, currentDeltaRef.current)
      setRangeHighlight({
        type: "drag",
        itemId: item.id,
        ...range,
      })

      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = requestAnimationFrame(() => {
        applyTransform(item, range.startDate)
        rafIdRef.current = null
      })
    },
    [applyTransform, calculateRange, item, setRangeHighlight, store]
  )

  useEffect(() => {
    const previousOrigin = previousOriginRef.current
    if (isDragging && previousOrigin.getTime() !== origin.getTime()) {
      originScrollLeftRef.current += dateToPx(
        previousOrigin,
        origin,
        viewportMode
      )
      updatePreview(currentClientXRef.current)
    }
    previousOriginRef.current = origin
  }, [isDragging, origin, updatePreview, viewportMode])

  useEffect(() => {
    if (!isDragging || !store) return
    return store.subscribe((state, previousState) => {
      if (state.scrollLeft !== previousState.scrollLeft) {
        updatePreview(currentClientXRef.current)
      }
    })
  }, [isDragging, store, updatePreview])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<Element> | PointerEvent) => {
      if (readOnly || getItemPermissions?.(item).move === false) return
      e.preventDefault?.()
      ;(e.currentTarget as Element | null)?.setPointerCapture?.(
        (e as PointerEvent).pointerId ?? 1
      )

      const scrollLeft = store?.getState().scrollLeft ?? 0
      originXRef.current = e.clientX
      currentClientXRef.current = e.clientX
      originScrollLeftRef.current = scrollLeft
      previousOriginRef.current = origin
      currentDeltaRef.current = 0
      gestureItemRef.current = item
      setIsDragging(true)
      setRangeHighlight({
        type: "drag",
        itemId: item.id,
        startDate: item.startDate,
        endDate: item.endDate,
      })

      const selectedIds = store?.getState().selectedIds ?? new Set<string>()
      startDrag({
        type: "move",
        itemIds: selectedIds.has(item.id) ? [...selectedIds] : [item.id],
        originX: e.clientX,
        currentX: e.clientX,
        originScrollLeft: scrollLeft,
      })
    },
    [
      getItemPermissions,
      item,
      origin,
      readOnly,
      setRangeHighlight,
      startDrag,
      store,
    ]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<Element> | PointerEvent) => {
      if (!isDragging) return
      currentClientXRef.current = e.clientX
      updatePreview(e.clientX)
    },
    [isDragging, updatePreview]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<Element> | PointerEvent) => {
      if (!isDragging) return

      currentClientXRef.current = e.clientX
      const currentScrollLeft =
        store?.getState().scrollLeft ?? originScrollLeftRef.current
      currentDeltaRef.current =
        e.clientX -
        originXRef.current +
        currentScrollLeft -
        originScrollLeftRef.current

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }

      const deltaX = currentDeltaRef.current
      if (deltaX !== 0) {
        const selectedIds = store?.getState().selectedIds ?? new Set<string>()
        const itemIds = selectedIds.has(item.id) ? [...selectedIds] : [item.id]

        const changes = []
        for (const id of itemIds) {
          const targetItem =
            id === item.id ? item : store?.getState().items.get(id)
          if (!targetItem) continue

          const range = calculateRange(targetItem, deltaX)
          changes.push({ itemId: id, ...range, previousItem: targetItem })
        }
        if (changes.length > 0) {
          if (mutationController) {
            void mutationController.dispatch({ type: "move", changes })
          } else {
            for (const change of changes) {
              updateItem(change.itemId, {
                startDate: change.startDate,
                endDate: change.endDate,
              })
            }
          }
        }
      }

      resetTransform()
      gestureItemRef.current = null
      setIsDragging(false)
      clearRangeHighlight()
      endDrag()
    },
    [
      calculateRange,
      clearRangeHighlight,
      endDrag,
      isDragging,
      item,
      mutationController,
      resetTransform,
      store,
      updateItem,
    ]
  )

  const handleCancel = useCallback(
    (
      reason:
        | "escape"
        | "pointer-cancel"
        | "permission-change"
        | "live-update" = "pointer-cancel"
    ) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      resetTransform()
      setIsDragging(false)
      currentDeltaRef.current = 0
      gestureItemRef.current = null
      clearRangeHighlight()
      endDrag()
      onInteractionCancel?.({ itemIds: [item.id], reason })
    },
    [clearRangeHighlight, endDrag, item.id, onInteractionCancel, resetTransform]
  )

  useEffect(() => {
    const baseline = gestureItemRef.current
    if (
      !isDragging ||
      !baseline ||
      (baseline.startDate.getTime() === item.startDate.getTime() &&
        baseline.endDate.getTime() === item.endDate.getTime())
    )
      return
    handleCancel("live-update")
  }, [handleCancel, isDragging, item])

  useEffect(() => {
    if (!isDragging) return
    let reason: "escape" | "permission-change" | null = null
    if (!activeDragState) {
      reason = "escape"
    } else if (readOnly || getItemPermissions?.(item).move === false) {
      reason = "permission-change"
    }
    if (!reason) return
    const frame = requestAnimationFrame(() => handleCancel(reason))
    return () => cancelAnimationFrame(frame)
  }, [
    activeDragState,
    getItemPermissions,
    handleCancel,
    isDragging,
    item,
    readOnly,
  ])

  return {
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleCancel,
  }
}
