/**
 * TimelineGrid — vertical grid lines, alternating row backgrounds,
 * and weekend column shading.
 *
 * Acts as the positioning container for rows, bars, and the today marker.
 * Children (rows, today marker) are rendered inside this container.
 */
import React, { useMemo } from "react"
import { getMinutes } from "date-fns"
import { cn } from "../../../lib/utils.js"
import type { ViewportMode } from "../types.js"
import { isWeekend } from "../utils/date-utils.js"
import {
  getViewportConfig,
  shouldRenderColumnGuide,
} from "../utils/viewport-config.js"

interface TimelineGridProps {
  columns: Date[]
  columnWidth: number
  mode: ViewportMode
  totalWidth: number
  contentHeight: number
  columnStartIndex?: number
  children?: React.ReactNode
  onMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void
}

/**
 * Grid container that renders:
 * - Vertical column lines
 * - Weekend column shading
 * - Alternating row backgrounds
 * - Children (rows, today marker) positioned absolutely inside
 */
export const TimelineGrid = React.memo(
  React.forwardRef<HTMLDivElement, TimelineGridProps>(function TimelineGrid(
    {
      columns,
      columnWidth,
      mode,
      totalWidth,
      contentHeight,
      columnStartIndex = 0,
      children,
      onMouseMove,
      onMouseLeave,
    },
    ref
  ) {
    const showWeekendShading = getViewportConfig(mode).shadeWeekends

    const weekendColumns = useMemo(() => {
      if (!showWeekendShading) return []
      return columns
        .map((date, i) => ({
          date,
          left: (columnStartIndex + i) * columnWidth,
          isWeekend: isWeekend(date),
        }))
        .filter((c) => c.isWeekend)
    }, [columnStartIndex, columns, columnWidth, showWeekendShading])

    return (
      <div
        ref={ref}
        data-testid="timeline-grid"
        className="relative bg-background"
        style={{
          width: totalWidth,
          minWidth: totalWidth,
          height: contentHeight,
          minHeight: contentHeight,
        }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {/* Vertical grid lines */}
        {columns.map((date, i) =>
          shouldRenderColumnGuide(date, mode) ? (
            <div
              key={`line-${date.getTime()}`}
              className={cn(
                "pointer-events-none absolute top-0 h-full border-r",
                mode === "hours" && getMinutes(date) === 0
                  ? "border-border/45"
                  : "border-border/20"
              )}
              style={{
                left: (columnStartIndex + i) * columnWidth - 1,
                width: 1,
              }}
              data-testid="grid-column-line"
              data-hour-boundary={
                mode === "hours" && getMinutes(date) === 0 ? true : undefined
              }
            />
          ) : null
        )}

        {/* Weekend shading */}
        {weekendColumns.map((col) => (
          <div
            key={`weekend-${col.date.getTime()}`}
            className="pointer-events-none absolute top-0 h-full bg-muted/15"
            style={{ left: col.left, width: columnWidth }}
            data-testid="grid-weekend-shading"
          />
        ))}

        {/* Children: rows, today marker, etc. */}
        {children}
      </div>
    )
  })
)
