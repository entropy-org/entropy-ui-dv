/**
 * Component: TimelineGhostBar
 *
 * A semi-transparent "ghost" bar that appears when the user hovers over an
 * empty area of the timeline grid. It shows where a new item would be added
 * if the user clicks.
 *
 * - Positioned centered under the cursor with a minimum clickable width.
 * - Click fires `config.onItemAdd(startDate, endDate, rowIndex)`.
 * - Hidden (returns null) when `readOnly` is true.
 */
import React from "react"
import { useTimelineStore } from "../hooks/use-timeline-store.js"
import { useTimelineConfig } from "../context/timeline-config-context.js"
import { useOptionalTimelineMutations } from "../context/timeline-mutation-context.js"
import { cn } from "../../../lib/utils.js"

const MIN_GHOST_WIDTH = 32

export interface TimelineGhostBarProps {
  /** Row index where the ghost bar is shown */
  rowIndex: number
  /** Snapped start date for the new item */
  startDate: Date
  /** Snapped end date for the new item */
  endDate: Date
  /** Cursor X position relative to the grid (used for positioning) */
  relativeX: number
  /** Total width of the grid content (for edge clamping) */
  totalWidth: number
  /** Optional extra class names */
  className?: string
}

/**
 * Renders a ghost bar indicating where a new item would be created.
 * Returns `null` when `readOnly` is true.
 */
export const TimelineGhostBar = React.forwardRef<
  HTMLDivElement,
  TimelineGhostBarProps
>(function TimelineGhostBar(
  { rowIndex, startDate, endDate, relativeX, totalWidth, className },
  ref
) {
  const readOnly = useTimelineStore((s) => s.readOnly)
  const { onItemAdd, onMutation } = useTimelineConfig()
  const mutations = useOptionalTimelineMutations()

  if (readOnly) return null

  const visualWidth = MIN_GHOST_WIDTH
  const visualLeft = Math.max(
    0,
    Math.min(relativeX - visualWidth / 2, totalWidth - visualWidth)
  )

  const handleClick = () => {
    if (mutations && onMutation) {
      void mutations.dispatch({
        type: "create",
        requestedRange: { startDate, endDate, rowIndex },
      })
    } else {
      onItemAdd?.(startDate, endDate, rowIndex)
    }
  }

  return (
    <div
      ref={ref}
      data-testid="timeline-ghost-bar"
      role="button"
      aria-label="Add new item here"
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        handleClick()
      }}
      tabIndex={0}
      className={cn(
        "pointer-events-auto absolute top-2 bottom-2 cursor-pointer rounded-sm border border-border/45 bg-muted/15 opacity-65",
        "after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:text-[13px] after:leading-none after:font-normal after:text-muted-foreground/60 after:content-['+']",
        "transition-[background-color,border-color,opacity] duration-150 hover:border-border/70 hover:bg-muted/25 hover:opacity-85",
        className
      )}
      style={{
        left: visualLeft,
        width: visualWidth,
      }}
    />
  )
})
