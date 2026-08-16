import React, { useCallback, useMemo, useRef, useState } from "react"
import { useTimelineConfig } from "../context/timeline-config-context.js"
import { useTimelineStore } from "../hooks/use-timeline-store.js"
import { useBarPosition } from "../hooks/use-bar-position.js"
import { useDrag } from "../hooks/use-drag.js"
import { useResize } from "../hooks/use-resize.js"
import { useMultiSelect } from "../hooks/use-multi-select.js"
import type { TimelineItem } from "../types.js"
import { cn } from "../../../lib/utils.js"
import { ChevronRight } from "lucide-react"
import { TimelineRendererBoundary } from "./timeline-renderer-boundary.js"

interface TimelineBarProps {
  item: TimelineItem
  origin: Date
  hierarchy?: TimelineBarHierarchy
  onDependencyStart?: (
    event: React.PointerEvent<HTMLElement>,
    item: TimelineItem
  ) => void
}

export type TimelineBarHierarchy =
  | { type: "none" }
  | {
      type: "parent"
      isExpanded: boolean
      onToggle: () => void
    }

const TimelineParentToggle = React.memo(
  React.forwardRef<
    HTMLButtonElement,
    {
      isExpanded: boolean
      onToggle: () => void
      itemId: string
    }
  >(function TimelineParentToggle({ isExpanded, onToggle, itemId }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        data-testid={`timeline-parent-toggle-${itemId}`}
        className="absolute top-1/2 left-1.5 z-20 flex size-[18px] -translate-y-1/2 items-center justify-center rounded-sm text-current/65 transition-[color,background-color,transform] duration-150 ease-out hover:bg-white/10 hover:text-current focus-visible:bg-white/10 focus-visible:text-current focus-visible:ring-1 focus-visible:ring-white/35 focus-visible:outline-none"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Collapse sub-items" : "Expand sub-items"}
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
      >
        <ChevronRight
          aria-hidden="true"
          strokeWidth={2}
          className={cn(
            "size-3.5 drop-shadow-[0_1px_1px_rgb(0_0_0/0.22)] transition-transform duration-150 ease-out motion-reduce:transition-none",
            isExpanded && "rotate-90"
          )}
        />
      </button>
    )
  })
)

const TimelineDependencyPort = React.memo(
  React.forwardRef<
    HTMLButtonElement,
    {
      item: TimelineItem
      onStart: NonNullable<TimelineBarProps["onDependencyStart"]>
    }
  >(function TimelineDependencyPort({ item, onStart }, ref) {
    const isActive = useTimelineStore(
      (s) => s.activeDependencyPortId === item.id
    )
    return (
      <button
        ref={ref}
        type="button"
        data-testid={`dependency-port-${item.id}`}
        data-dependency-port="finish-to-start"
        className={cn(
          "absolute top-1/2 -right-5 z-40 flex size-3 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/75 bg-background text-amber-500 shadow-[0_1px_5px_rgb(245_158_11/0.22)] transition-[opacity,transform,box-shadow,background-color] duration-150 ease-out before:absolute before:top-1/2 before:right-full before:h-px before:w-2 before:-translate-y-1/2 before:rounded-full before:bg-amber-400/65 hover:bg-amber-50 hover:shadow-[0_2px_8px_rgb(245_158_11/0.34)] focus-visible:ring-2 focus-visible:ring-amber-400/30 focus-visible:outline-none dark:border-amber-500/65 dark:hover:bg-amber-950",
          isActive
            ? "scale-100 opacity-100"
            : "scale-75 opacity-0 focus-visible:scale-100 focus-visible:opacity-100"
        )}
        aria-label={`Create dependency from ${item.id}`}
        title="Drag to another row to create a dependency"
        onPointerDown={(event) => onStart(event, item)}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        <span className="size-1 rounded-full bg-current" />
      </button>
    )
  })
)

/**
 * Renders a single timeline bar for an item.
 *
 * - Positioned at the correct pixel offset via `useBarPosition`.
 * - Delegates content rendering to the consumer's `renderBar`.
 * - Wires drag, left/right resize handles, and click-based multi-select.
 * - GPU-first: drag applies `transform: translate3d()` via ref (no layout thrashing).
 * - Read-only: drag and resize are no-ops; click still selects.
 */
export const TimelineBar = React.memo(
  React.forwardRef<HTMLDivElement, TimelineBarProps>(function TimelineBar(
    { item, origin, hierarchy = { type: "none" }, onDependencyStart },
    ref
  ) {
    const { getItemAriaLabel, getItemPermissions, renderBar } =
      useTimelineConfig()
    const isSelected = useTimelineStore((s) => s.selectedIds.has(item.id))
    const readOnly = useTimelineStore((s) => s.readOnly)
    const setRangeHighlight = useTimelineStore(
      (s) => s.actions.setRangeHighlight
    )
    const clearRangeHighlight = useTimelineStore(
      (s) => s.actions.clearRangeHighlight
    )
    const setActiveDependencyPort = useTimelineStore(
      (s) => s.actions.setActiveDependencyPort
    )
    const permissions = getItemPermissions?.(item) ?? {}

    // Edge hover state — only show resize handles near the bar edges
    const [hoverEdge, setHoverEdge] = useState<"left" | "right" | null>(null)
    const hoverEdgeRef = useRef<"left" | "right" | null>(null)

    // Internal ref for DOM transforms (drag / resize)
    const barRef = useRef<HTMLDivElement>(null)

    // Position from store/mode
    const pos = useBarPosition(item.startDate, item.endDate, origin)

    // ── Interactions ──────────────────────────────────────────────────────

    const drag = useDrag({ item, origin, barRef })
    const resizeLeft = useResize({
      item,
      origin,
      barRef,
      handle: "left",
    })
    const resizeRight = useResize({
      item,
      origin,
      barRef,
      handle: "right",
    })
    const { handleClick } = useMultiSelect()

    const isDragging = drag.isDragging
    const isResizing = resizeLeft.isResizing || resizeRight.isResizing

    const state = useMemo(
      () => ({ isDragging, isSelected }),
      [isDragging, isSelected]
    )
    const positionStyle = useMemo(
      () => ({ left: pos.left, width: pos.width }),
      [pos.left, pos.width]
    )

    // ── Pointer handlers ──────────────────────────────────────────────────

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        e.stopPropagation()
        drag.handlePointerDown(e)
      },
      [drag]
    )

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        // Edge detection for resize handle visibility
        if (!isResizing && !isDragging) {
          const rect = e.currentTarget.getBoundingClientRect()
          const relX = e.clientX - rect.left
          let next: "left" | "right" | null = null
          if (relX < 10) {
            next = "left"
          } else if (relX > rect.width - 10) {
            next = "right"
          }
          if (next !== hoverEdgeRef.current) {
            hoverEdgeRef.current = next
            setHoverEdge(next)
          }
        }

        if (resizeLeft.isResizing) {
          resizeLeft.handlePointerMove(e)
          return
        }
        if (resizeRight.isResizing) {
          resizeRight.handlePointerMove(e)
          return
        }
        drag.handlePointerMove(e)
      },
      [drag, resizeLeft, resizeRight, isResizing, isDragging]
    )

    const handlePointerUp = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (resizeLeft.isResizing) {
          resizeLeft.handlePointerUp(e)
          return
        }
        if (resizeRight.isResizing) {
          resizeRight.handlePointerUp(e)
          return
        }
        drag.handlePointerUp(e)
      },
      [drag, resizeLeft, resizeRight]
    )

    const handlePointerCancel = useCallback(() => {
      if (resizeLeft.isResizing) {
        resizeLeft.handleCancel()
        return
      }
      if (resizeRight.isResizing) {
        resizeRight.handleCancel()
        return
      }
      drag.handleCancel()
    }, [drag, resizeLeft, resizeRight])

    const handleBarClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (permissions.select === false) return
        handleClick(item.id, e.shiftKey, e.ctrlKey || e.metaKey)
      },
      [handleClick, item.id, permissions.select]
    )

    const handleMouseEnter = useCallback(() => {
      if (isDragging || isResizing) return
      setActiveDependencyPort(item.id)
      setRangeHighlight({
        type: "row",
        itemId: item.id,
        startDate: item.startDate,
        endDate: item.endDate,
      })
    }, [
      isDragging,
      isResizing,
      item,
      setRangeHighlight,
      setActiveDependencyPort,
    ])

    const handleMouseLeave = useCallback(() => {
      setHoverEdge(null)
      hoverEdgeRef.current = null
      if (!isDragging && !isResizing) clearRangeHighlight()
    }, [clearRangeHighlight, isDragging, isResizing])

    // Merge the external forwardRef with our internal barRef
    const mergedRef = useCallback(
      (node: HTMLDivElement | null) => {
        barRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref)
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      },
      [ref]
    )

    return (
      <div
        ref={mergedRef}
        data-testid={`timeline-bar-${item.id}`}
        data-timeline-bar="true"
        data-timeline-bar-id={item.id}
        className={cn(
          "group absolute top-1.5 bottom-1.5 touch-none rounded-md will-change-transform outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isSelected && "z-20 ring-1 ring-foreground/20 ring-inset",
          isDragging &&
            "z-50 cursor-grabbing opacity-95 brightness-[1.02] drop-shadow-lg",
          !isDragging &&
            !isResizing &&
            "cursor-pointer transition-[filter,box-shadow] duration-150 hover:brightness-[1.04]"
        )}
        style={positionStyle}
        role="group"
        aria-label={getItemAriaLabel?.(item) ?? item.id}
        aria-disabled={permissions.select === false || undefined}
        tabIndex={permissions.select === false ? -1 : 0}
        draggable={false}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDragStart={(event) => event.preventDefault()}
        onClick={handleBarClick}
        onKeyDown={(event) => {
          if (
            permissions.select === false ||
            (event.key !== "Enter" && event.key !== " ")
          )
            return
          event.preventDefault()
          handleClick(item.id, event.shiftKey, event.ctrlKey || event.metaKey)
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="sr-only">
          {isSelected ? "Selected. " : null}
          {isDragging ? "Moving. " : null}
          {isResizing ? "Resizing. " : null}
        </span>
        {hierarchy.type === "parent" && (
          <TimelineParentToggle
            itemId={item.id}
            isExpanded={hierarchy.isExpanded}
            onToggle={hierarchy.onToggle}
          />
        )}

        {onDependencyStart && permissions.dependencies !== false && (
          <TimelineDependencyPort item={item} onStart={onDependencyStart} />
        )}

        {/* Left resize handle */}
        {!readOnly && permissions.resize !== false && (
          <div
            data-testid={`resize-handle-left-${item.id}`}
            className={cn(
              "absolute top-0 bottom-0 left-0 z-10 w-2 cursor-ew-resize transition-opacity before:absolute before:top-1/2 before:left-0.5 before:h-3 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-white/90 before:shadow-sm",
              hoverEdge === "left" || isResizing ? "opacity-100" : "opacity-0"
            )}
            onPointerDown={(e) => {
              e.stopPropagation() // prevent bar drag from triggering
              resizeLeft.handlePointerDown(e)
            }}
          />
        )}

        {/* Bar content — consumer-rendered */}
        <div
          data-timeline-bar-content="true"
          className={cn(
            "h-full w-full",
            hierarchy.type === "parent" && "[&>*]:!pl-6"
          )}
        >
          <TimelineRendererBoundary
            surface="bar"
            item={item}
            fallback={
              <span className="px-2 text-xs">Unable to render item</span>
            }
          >
            {() => renderBar(item, state)}
          </TimelineRendererBoundary>
        </div>

        {/* Right resize handle */}
        {!readOnly && permissions.resize !== false && (
          <div
            data-testid={`resize-handle-right-${item.id}`}
            className={cn(
              "absolute top-0 right-0 bottom-0 z-10 w-2 cursor-ew-resize transition-opacity before:absolute before:top-1/2 before:right-0.5 before:h-3 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-white/90 before:shadow-sm",
              hoverEdge === "right" || isResizing ? "opacity-100" : "opacity-0"
            )}
            onPointerDown={(e) => {
              e.stopPropagation()
              resizeRight.handlePointerDown(e)
            }}
          />
        )}
      </div>
    )
  })
)
