/**
 * TimelineSidebar — resizable left panel that displays item labels.
 *
 * Scroll position is synced with the main grid viewport.
 * Contains a draggable divider on the right edge for resizing.
 */
import React, { useCallback, useEffect, useRef } from "react"
import { useTimelineStore } from "../hooks/use-timeline-store.js"
import { cn } from "../../../lib/utils.js"
import { ListTree } from "lucide-react"

interface TimelineSidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current vertical scroll offset (synced from viewport) */
  scrollTop: number
  /** Header height to offset content start */
  headerHeight: number
  /** Total number of visible timeline rows */
  itemCount?: number
  children?: React.ReactNode
}

/**
 * Sidebar panel with a draggable resize handle on the right edge.
 * Scroll position is synced from the main viewport via `scrollTop` prop.
 */
export const TimelineSidebar = React.memo(
  React.forwardRef<HTMLDivElement, TimelineSidebarProps>(
    function TimelineSidebar(
      { scrollTop, headerHeight, itemCount = 0, children, className, ...props },
      ref
    ) {
      const sidebarWidth = useTimelineStore((s) => s.sidebarWidth)
      const setSidebarWidth = useTimelineStore((s) => s.actions.setSidebarWidth)
      const setSidebarResizing = useTimelineStore(
        (s) => s.actions.setSidebarResizing
      )

      const scrollContainerRef = useRef<HTMLDivElement>(null)
      const isDragging = useRef(false)
      const dragStartX = useRef(0)
      const dragStartWidth = useRef(0)

      // Sync scroll position with the grid
      useEffect(() => {
        const el = scrollContainerRef.current
        if (!el) return
        el.scrollTop = scrollTop
      }, [scrollTop])

      // ── Resize divider handlers ─────────────────────────────────────────
      const handleDividerPointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
          e.preventDefault()
          e.stopPropagation()
          isDragging.current = true
          setSidebarResizing(true)
          dragStartX.current = e.clientX
          dragStartWidth.current = sidebarWidth

          const target = e.currentTarget
          target.setPointerCapture(e.pointerId)
        },
        [setSidebarResizing, sidebarWidth]
      )

      const handleDividerPointerMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
          if (!isDragging.current) return
          const delta = e.clientX - dragStartX.current
          setSidebarWidth(dragStartWidth.current + delta)
        },
        [setSidebarWidth]
      )

      const handleDividerPointerUp = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
          if (!isDragging.current) return
          isDragging.current = false
          setSidebarResizing(false)
          const target = e.currentTarget
          target.releasePointerCapture(e.pointerId)
        },
        [setSidebarResizing]
      )

      const handleDividerPointerCancel = useCallback(() => {
        isDragging.current = false
        setSidebarResizing(false)
      }, [setSidebarResizing])

      return (
        <div
          ref={ref}
          data-testid="timeline-sidebar"
          className={cn(
            "relative z-20 h-full flex-shrink-0 border-r border-border/80 bg-background shadow-[8px_0_22px_rgb(0_0_0/0.025)]",
            className
          )}
          style={{ width: sidebarWidth }}
          {...props}
        >
          {/* Header spacer — aligns sidebar content with grid rows */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between border-b border-border/80 bg-background/95 px-3 backdrop-blur-xl"
            style={{ height: headerHeight }}
            data-testid="sidebar-header-spacer"
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ListTree className="size-3.5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">Work items</p>
                <p className="text-[10px] text-muted-foreground">
                  {itemCount} {itemCount === 1 ? "row" : "rows"}
                </p>
              </div>
            </div>
          </div>

          {/* Scrollable content — scroll synced with main viewport */}
          <div
            ref={scrollContainerRef}
            className="overflow-hidden"
            style={{ height: `calc(100% - ${headerHeight}px)` }}
            data-testid="sidebar-scroll-container"
          >
            {children}
          </div>

          {/* Resize divider */}
          <div
            data-testid="sidebar-resize-divider"
            className={cn(
              "absolute top-0 right-0 z-20 h-full w-1 cursor-col-resize",
              "after:absolute after:top-1/2 after:left-1/2 after:h-9 after:w-1 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-border after:transition-all",
              "hover:after:h-12 hover:after:bg-primary/60 active:after:bg-primary"
            )}
            onPointerDown={handleDividerPointerDown}
            onPointerMove={handleDividerPointerMove}
            onPointerUp={handleDividerPointerUp}
            onPointerCancel={handleDividerPointerCancel}
          />
        </div>
      )
    }
  )
)
