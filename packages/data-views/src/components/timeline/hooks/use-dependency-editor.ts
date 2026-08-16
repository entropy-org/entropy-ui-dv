import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react"
import { useTimelineConfig } from "../context/timeline-config-context.js"
import { TimelineContext } from "../context/timeline-context.js"
import { computeDependencyDraftPath } from "../utils/dependency-path.js"
import type { TimelineItem } from "../types.js"
import { useOptionalTimelineMutations } from "../context/timeline-mutation-context.js"

type Point = { x: number; y: number }

export type DependencyEditorState =
  | { type: "idle" }
  | {
      type: "linking"
      fromItemId: string
      source: Point
    }

type ActiveDependency = Extract<DependencyEditorState, { type: "linking" }>

interface UseDependencyEditorOptions {
  enabled: boolean
  gridRef: RefObject<HTMLDivElement | null>
}

interface DependencyTarget {
  itemId: string
  row: HTMLElement
  point: Point | null
}

let dependencyIdSequence = 0

function createDependencyId(fromItemId: string, toItemId: string): string {
  dependencyIdSequence += 1
  return `dependency-${fromItemId}-${toItemId}-${Date.now().toString(36)}-${dependencyIdSequence}`
}

/**
 * High-frequency dependency creation controller.
 *
 * React state is updated only when the interaction starts or ends. Pointer
 * movement updates the draft SVG path directly, coalesced to one write per
 * animation frame.
 */
export function useDependencyEditor({
  enabled,
  gridRef,
}: UseDependencyEditorOptions) {
  const { dependenciesList, getItemPermissions, onDependencyAdd, onMutation } =
    useTimelineConfig()
  const mutations = useOptionalTimelineMutations()
  const store = useContext(TimelineContext)
  if (!store) {
    throw new Error(
      "useDependencyEditor must be used within a TimelineProvider"
    )
  }
  const [state, setState] = useState<DependencyEditorState>({ type: "idle" })
  const activeRef = useRef<ActiveDependency | null>(null)
  const latestPointerRef = useRef<Point>({ x: 0, y: 0 })
  const frameRef = useRef<number | null>(null)
  const highlightedRowRef = useRef<HTMLElement | null>(null)
  const cleanupListenersRef = useRef<(() => void) | null>(null)
  const draftPathRef = useRef<SVGPathElement>(null)
  const draftEndpointRef = useRef<SVGCircleElement>(null)
  const configRef = useRef({
    dependenciesList,
    getItemPermissions,
    onDependencyAdd,
    onMutation,
    mutations,
  })

  useEffect(() => {
    configRef.current = {
      dependenciesList,
      getItemPermissions,
      onDependencyAdd,
      onMutation,
      mutations,
    }
  }, [
    dependenciesList,
    getItemPermissions,
    mutations,
    onDependencyAdd,
    onMutation,
  ])

  const clearTargetHighlight = useCallback(() => {
    highlightedRowRef.current?.removeAttribute("data-dependency-target")
    highlightedRowRef.current = null
  }, [])

  const resolveTarget = useCallback(
    (clientX: number, clientY: number): DependencyTarget | null => {
      const grid = gridRef.current
      const active = activeRef.current
      if (!grid || !active) return null

      const elements =
        typeof document.elementsFromPoint === "function"
          ? document.elementsFromPoint(clientX, clientY)
          : [document.elementFromPoint(clientX, clientY)].filter(
              (element): element is Element => element !== null
            )
      let row: HTMLElement | null = null
      for (const element of elements) {
        const candidate = element.closest<HTMLElement>(
          "[data-timeline-row-item-id]"
        )
        if (candidate && grid.contains(candidate)) {
          row = candidate
          break
        }
      }

      const itemId = row?.dataset.timelineRowItemId
      if (!row || !itemId || itemId === active.fromItemId) return null

      const gridRect = grid.getBoundingClientRect()
      const bars = grid.querySelectorAll<HTMLElement>("[data-timeline-bar-id]")
      const targetBar = Array.from(bars).find(
        (bar) => bar.dataset.timelineBarId === itemId
      )
      const barRect = targetBar?.getBoundingClientRect()

      return {
        itemId,
        row,
        point: barRect
          ? {
              x: barRect.left - gridRect.left,
              y: barRect.top - gridRect.top + barRect.height / 2,
            }
          : null,
      }
    },
    [gridRef]
  )

  const renderFrame = useCallback(() => {
    frameRef.current = null
    const grid = gridRef.current
    const active = activeRef.current
    const path = draftPathRef.current
    if (!grid || !active || !path) return

    const pointer = latestPointerRef.current
    const target = resolveTarget(pointer.x, pointer.y)
    if (highlightedRowRef.current !== target?.row) {
      clearTargetHighlight()
      if (target) {
        target.row.setAttribute("data-dependency-target", "true")
        highlightedRowRef.current = target.row
      }
    }

    const gridRect = grid.getBoundingClientRect()
    const endPoint = target?.point ?? {
      x: pointer.x - gridRect.left,
      y: pointer.y - gridRect.top,
    }

    path.setAttribute("d", computeDependencyDraftPath(active.source, endPoint))
    path.toggleAttribute("data-backward", endPoint.x < active.source.x)
    draftEndpointRef.current?.setAttribute("cx", String(endPoint.x))
    draftEndpointRef.current?.setAttribute("cy", String(endPoint.y))
    draftEndpointRef.current?.toggleAttribute("data-snapped", Boolean(target))
  }, [clearTargetHighlight, gridRef, resolveTarget])

  const scheduleFrame = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(renderFrame)
  }, [renderFrame])

  const stop = useCallback(() => {
    cleanupListenersRef.current?.()
    cleanupListenersRef.current = null
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    clearTargetHighlight()
    activeRef.current = null
    setState({ type: "idle" })
  }, [clearTargetHighlight])

  const startDependency = useCallback(
    (event: React.PointerEvent<HTMLElement>, item: TimelineItem) => {
      if (
        !enabled ||
        (!configRef.current.onDependencyAdd && !configRef.current.onMutation) ||
        configRef.current.getItemPermissions?.(item).dependencies === false
      )
        return

      event.preventDefault()
      event.stopPropagation()
      cleanupListenersRef.current?.()

      const grid = gridRef.current
      if (!grid) return
      const sourceRect = event.currentTarget.getBoundingClientRect()
      const gridRect = grid.getBoundingClientRect()
      const source = {
        x: sourceRect.right - gridRect.left,
        y: sourceRect.top - gridRect.top + sourceRect.height / 2,
      }
      const nextState: ActiveDependency = {
        type: "linking",
        fromItemId: item.id,
        source,
      }

      activeRef.current = nextState
      latestPointerRef.current = { x: event.clientX, y: event.clientY }
      setState(nextState)

      const previousCursor = document.documentElement.style.cursor
      document.documentElement.style.cursor = "crosshair"

      const handlePointerMove = (pointerEvent: PointerEvent) => {
        latestPointerRef.current = {
          x: pointerEvent.clientX,
          y: pointerEvent.clientY,
        }
        scheduleFrame()
      }

      const handlePointerUp = (pointerEvent: PointerEvent) => {
        const active = activeRef.current
        const target = resolveTarget(pointerEvent.clientX, pointerEvent.clientY)
        if (active && target) {
          const currentDependencies = configRef.current.dependenciesList ?? []
          const isDuplicate = currentDependencies.some(
            (dependency) =>
              dependency.fromItemId === active.fromItemId &&
              dependency.toItemId === target.itemId &&
              dependency.type === "finish-to-start"
          )

          if (!isDuplicate) {
            const dependency = {
              id: createDependencyId(active.fromItemId, target.itemId),
              fromItemId: active.fromItemId,
              toItemId: target.itemId,
              type: "finish-to-start" as const,
            }
            const targetItem = store.getState().items.get(target.itemId)
            if (
              targetItem &&
              configRef.current.getItemPermissions?.(targetItem)
                .dependencies === false
            ) {
              stop()
              return
            }
            if (configRef.current.mutations && configRef.current.onMutation) {
              void configRef.current.mutations.dispatch({
                type: "dependency-add",
                dependency,
              })
            } else {
              configRef.current.onDependencyAdd?.(dependency)
            }
          }
        }
        stop()
      }

      const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
        if (keyboardEvent.key === "Escape") stop()
      }

      const cleanup = () => {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
        window.removeEventListener("pointercancel", stop)
        window.removeEventListener("blur", stop)
        window.removeEventListener("keydown", handleKeyDown)
        document.documentElement.style.cursor = previousCursor
      }

      cleanupListenersRef.current = cleanup
      window.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      })
      window.addEventListener("pointerup", handlePointerUp, { once: true })
      window.addEventListener("pointercancel", stop, { once: true })
      window.addEventListener("blur", stop, { once: true })
      window.addEventListener("keydown", handleKeyDown)
      scheduleFrame()
    },
    [enabled, gridRef, resolveTarget, scheduleFrame, stop, store]
  )

  useEffect(() => stop, [stop])

  useEffect(() => {
    if (enabled || state.type !== "linking") return
    const frameId = requestAnimationFrame(stop)
    return () => cancelAnimationFrame(frameId)
  }, [enabled, state.type, stop])

  useEffect(() => {
    if (state.type !== "linking") return
    return store.subscribe((current, previous) => {
      if (
        current.scrollLeft !== previous.scrollLeft ||
        current.scrollTop !== previous.scrollTop
      ) {
        scheduleFrame()
      }
    })
  }, [scheduleFrame, state.type, store])

  return {
    state,
    canCreate: enabled && Boolean(onDependencyAdd || onMutation),
    draftPathRef,
    draftEndpointRef,
    startDependency,
  }
}
