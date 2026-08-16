import { useCallback, useContext, useEffect, useRef, useState } from "react"
import type { RefObject } from "react"
import { addDays, addMinutes } from "date-fns"
import type { TimelineItem, ViewportMode } from "../types.js"
import { useTimelineStore } from "./use-timeline-store.js"
import {
  dateRangeToPxWidth,
  dateToPx,
  pxToDate,
} from "../utils/position-utils.js"
import { snapToGrid } from "../utils/snap-utils.js"
import { getColumnWidth } from "../utils/viewport-config.js"
import { TimelineContext } from "../context/timeline-context.js"
import { TimelineConfigContext } from "../context/timeline-config-context.js"
import { useOptionalTimelineMutations } from "../context/timeline-mutation-context.js"

export type ResizeHandle = "left" | "right"

export interface UseResizeOptions {
  item: TimelineItem
  origin: Date
  barRef: RefObject<HTMLElement | null>
  handle: ResizeHandle
}

export interface UseResizeResult {
  isResizing: boolean
  handlePointerDown: (e: React.PointerEvent<Element> | PointerEvent) => void
  handlePointerMove: (e: React.PointerEvent<Element> | PointerEvent) => void
  handlePointerUp: (e: React.PointerEvent<Element> | PointerEvent) => void
  handleCancel: () => void
}

type ResizePreview = {
  startDate: Date
  endDate: Date
}

function addResizeStep(
  date: Date,
  viewportMode: ViewportMode,
  direction: 1 | -1
): Date {
  return viewportMode === "hours"
    ? addMinutes(date, 15 * direction)
    : addDays(date, direction)
}

export function useResize({
  item,
  origin,
  barRef,
  handle,
}: UseResizeOptions): UseResizeResult {
  const viewportMode = useTimelineStore((s) => s.viewportMode)
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

  const [isResizing, setIsResizing] = useState(false)
  const originXRef = useRef(0)
  const currentClientXRef = useRef(0)
  const originScrollLeftRef = useRef(0)
  const previousOriginRef = useRef(origin)
  const previewRef = useRef<ResizePreview>({
    startDate: item.startDate,
    endDate: item.endDate,
  })
  const rafIdRef = useRef<number | null>(null)
  const originalStylesRef = useRef<{ left: string; width: string } | null>(null)
  const gestureItemRef = useRef<TimelineItem | null>(null)

  const calculatePreview = useCallback(
    (rawDeltaX: number): ResizePreview => {
      const startPx = dateToPx(item.startDate, origin, viewportMode)
      const endPx = dateToPx(item.endDate, origin, viewportMode)
      const minimumWidth = getColumnWidth(viewportMode)

      if (handle === "right") {
        const rawEndDate = pxToDate(
          Math.max(startPx + minimumWidth, endPx + rawDeltaX),
          origin,
          viewportMode
        )
        let endDate = snapToGrid(rawEndDate, viewportMode)
        if (endDate <= item.startDate) {
          endDate = addResizeStep(item.startDate, viewportMode, 1)
        }
        return {
          startDate: item.startDate,
          endDate,
        }
      }

      const rawStartDate = pxToDate(
        Math.min(endPx - minimumWidth, startPx + rawDeltaX),
        origin,
        viewportMode
      )
      let startDate = snapToGrid(rawStartDate, viewportMode)
      if (startDate >= item.endDate) {
        startDate = addResizeStep(item.endDate, viewportMode, -1)
      }
      return {
        startDate,
        endDate: item.endDate,
      }
    },
    [handle, item, origin, viewportMode]
  )

  const applyPreview = useCallback(
    (preview: ResizePreview) => {
      const bar = barRef.current
      if (!bar) return

      bar.style.left = `${dateToPx(preview.startDate, origin, viewportMode)}px`
      bar.style.width = `${dateRangeToPxWidth(
        preview.startDate,
        preview.endDate,
        viewportMode
      )}px`
    },
    [barRef, origin, viewportMode]
  )

  const publishPreview = useCallback(
    (preview: ResizePreview) => {
      previewRef.current = preview
      setRangeHighlight({
        type: "resize",
        itemId: item.id,
        startDate: preview.startDate,
        endDate: preview.endDate,
        activeEdge: handle === "left" ? "start" : "end",
      })

      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = requestAnimationFrame(() => {
        applyPreview(previewRef.current)
        rafIdRef.current = null
      })
    },
    [applyPreview, handle, item.id, setRangeHighlight]
  )

  const updatePreview = useCallback(
    (clientX: number) => {
      const currentScrollLeft =
        store?.getState().scrollLeft ?? originScrollLeftRef.current
      const rawDeltaX =
        clientX -
        originXRef.current +
        currentScrollLeft -
        originScrollLeftRef.current
      publishPreview(calculatePreview(rawDeltaX))
    },
    [calculatePreview, publishPreview, store]
  )

  const resetStyles = useCallback(() => {
    const bar = barRef.current
    const originalStyles = originalStylesRef.current
    if (!bar || !originalStyles) return
    bar.style.left = originalStyles.left
    bar.style.width = originalStyles.width
  }, [barRef])

  useEffect(() => {
    const previousOrigin = previousOriginRef.current
    if (isResizing && previousOrigin.getTime() !== origin.getTime()) {
      const originShift = dateToPx(previousOrigin, origin, viewportMode)
      originScrollLeftRef.current += originShift
      updatePreview(currentClientXRef.current)
    }
    previousOriginRef.current = origin
  }, [isResizing, origin, updatePreview, viewportMode])

  useEffect(() => {
    if (!isResizing || !store) return
    return store.subscribe((state, previousState) => {
      if (state.scrollLeft !== previousState.scrollLeft) {
        updatePreview(currentClientXRef.current)
      }
    })
  }, [isResizing, store, updatePreview])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<Element> | PointerEvent) => {
      if (readOnly || getItemPermissions?.(item).resize === false) return
      e.preventDefault?.()
      ;(e.currentTarget as Element | null)?.setPointerCapture?.(
        (e as PointerEvent).pointerId ?? 1
      )

      const scrollLeft = store?.getState().scrollLeft ?? 0
      originXRef.current = e.clientX
      currentClientXRef.current = e.clientX
      originScrollLeftRef.current = scrollLeft
      previousOriginRef.current = origin
      previewRef.current = {
        startDate: item.startDate,
        endDate: item.endDate,
      }
      gestureItemRef.current = item

      if (barRef.current) {
        originalStylesRef.current = {
          left: barRef.current.style.left,
          width: barRef.current.style.width,
        }
      }

      setIsResizing(true)
      setRangeHighlight({
        type: "resize",
        itemId: item.id,
        startDate: item.startDate,
        endDate: item.endDate,
        activeEdge: handle === "left" ? "start" : "end",
      })
      startDrag({
        type: handle === "left" ? "resize-left" : "resize-right",
        itemIds: [item.id],
        originX: e.clientX,
        currentX: e.clientX,
        originScrollLeft: scrollLeft,
      })
    },
    [
      barRef,
      getItemPermissions,
      handle,
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
      if (!isResizing) return
      currentClientXRef.current = e.clientX
      updatePreview(e.clientX)
    },
    [isResizing, updatePreview]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<Element> | PointerEvent) => {
      if (!isResizing) return

      const currentScrollLeft =
        store?.getState().scrollLeft ?? originScrollLeftRef.current
      const rawDeltaX =
        e.clientX -
        originXRef.current +
        currentScrollLeft -
        originScrollLeftRef.current
      const preview = calculatePreview(rawDeltaX)

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }

      if (mutationController) {
        void mutationController.dispatch({
          type: "resize",
          itemId: item.id,
          edge: handle === "right" ? "end" : "start",
          startDate: preview.startDate,
          endDate: preview.endDate,
          previousItem: item,
        })
      } else {
        updateItem(
          item.id,
          handle === "right"
            ? { endDate: preview.endDate }
            : { startDate: preview.startDate }
        )
      }
      resetStyles()
      gestureItemRef.current = null
      setIsResizing(false)
      clearRangeHighlight()
      endDrag()
    },
    [
      calculatePreview,
      clearRangeHighlight,
      endDrag,
      handle,
      isResizing,
      item,
      mutationController,
      resetStyles,
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
      resetStyles()
      gestureItemRef.current = null
      setIsResizing(false)
      clearRangeHighlight()
      endDrag()
      onInteractionCancel?.({ itemIds: [item.id], reason })
    },
    [clearRangeHighlight, endDrag, item.id, onInteractionCancel, resetStyles]
  )

  useEffect(() => {
    const baseline = gestureItemRef.current
    if (
      !isResizing ||
      !baseline ||
      (baseline.startDate.getTime() === item.startDate.getTime() &&
        baseline.endDate.getTime() === item.endDate.getTime())
    )
      return
    handleCancel("live-update")
  }, [handleCancel, isResizing, item])

  useEffect(() => {
    if (!isResizing) return
    let reason: "escape" | "permission-change" | null = null
    if (!activeDragState) {
      reason = "escape"
    } else if (readOnly || getItemPermissions?.(item).resize === false) {
      reason = "permission-change"
    }
    if (!reason) return
    const frame = requestAnimationFrame(() => handleCancel(reason))
    return () => cancelAnimationFrame(frame)
  }, [
    activeDragState,
    getItemPermissions,
    handleCancel,
    isResizing,
    item,
    readOnly,
  ])

  return {
    isResizing,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleCancel,
  }
}
