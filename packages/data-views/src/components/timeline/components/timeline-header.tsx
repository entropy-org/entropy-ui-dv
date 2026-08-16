import React, { useMemo } from "react"
import { format, getDaysInMonth, isWeekend } from "date-fns"
import type {
  TimelineRangeHighlight,
  ViewportMode,
} from "../types.js"
import {
  getPrimaryHeaderLabel,
  getSecondaryHeaderLabel,
} from "../utils/date-utils.js"
import {
  getViewportConfig,
  shouldRenderHeaderLabel,
} from "../utils/viewport-config.js"
import { dateToPx } from "../utils/position-utils.js"
import { TimelineTodayHeaderMarker } from "./timeline-today-header-marker.js"
import { cn } from "../../../lib/utils.js"

interface HeaderGroup {
  label: string
  left: number
  width: number
}

interface HeaderCell {
  date: Date
  isWeekend: boolean
  label: string
  left: number
  width: number
}

interface TimelineHeaderProps {
  columns: Date[]
  columnWidth: number
  mode: ViewportMode
  origin: Date
  rangeHighlight?: TimelineRangeHighlight | null
  totalWidth: number
  columnStartIndex?: number
}

function getRangeLabel(date: Date, mode: ViewportMode): string {
  return format(date, mode === "hours" ? "d MMM · h:mm a" : "d MMM")
}

function computeGroups(
  columns: Date[],
  mode: ViewportMode,
  columnWidth: number,
  columnStartIndex: number
): HeaderGroup[] {
  if (columns.length === 0) return []

  const groups: HeaderGroup[] = []
  let label = getPrimaryHeaderLabel(columns[0], mode)
  let startIndex = 0

  for (let index = 1; index < columns.length; index += 1) {
    const nextLabel = getPrimaryHeaderLabel(columns[index], mode)
    if (nextLabel === label) continue

    groups.push({
      label,
      left: (columnStartIndex + startIndex) * columnWidth,
      width: (index - startIndex) * columnWidth,
    })
    label = nextLabel
    startIndex = index
  }

  groups.push({
    label,
    left: (columnStartIndex + startIndex) * columnWidth,
    width: (columns.length - startIndex) * columnWidth,
  })

  return groups
}

function computeCells(
  columns: Date[],
  mode: ViewportMode,
  columnWidth: number,
  columnStartIndex: number
): HeaderCell[] {
  const config = getViewportConfig(mode)

  return columns.flatMap((date, index) => {
    if (!shouldRenderHeaderLabel(date, mode)) return []

    const remainingDays = getDaysInMonth(date) - date.getDate() + 1
    const span =
      mode === "hours" ? 2 : Math.min(config.dayLabelStep, remainingDays)

    return [
      {
        date,
        isWeekend: config.shadeWeekends && isWeekend(date),
        label: getSecondaryHeaderLabel(date, mode),
        left: (columnStartIndex + index) * columnWidth,
        width: span * columnWidth,
      },
    ]
  })
}

export const TimelineHeader = React.memo(
  React.forwardRef<HTMLDivElement, TimelineHeaderProps>(function TimelineHeader(
    {
      columns,
      columnWidth,
      mode,
      origin,
      rangeHighlight,
      totalWidth,
      columnStartIndex = 0,
    },
    ref
  ) {
    const groups = useMemo(
      () => computeGroups(columns, mode, columnWidth, columnStartIndex),
      [columnStartIndex, columnWidth, columns, mode]
    )
    const cells = useMemo(
      () => computeCells(columns, mode, columnWidth, columnStartIndex),
      [columnStartIndex, columnWidth, columns, mode]
    )
    const highlightedRange = useMemo(() => {
      if (!rangeHighlight) return null

      const start = dateToPx(rangeHighlight.startDate, origin, mode)
      const end = dateToPx(rangeHighlight.endDate, origin, mode)

      return {
        activeEdge:
          rangeHighlight.type === "resize" ? rangeHighlight.activeEdge : null,
        end,
        endLabel: getRangeLabel(rangeHighlight.endDate, mode),
        left: Math.min(start, end),
        start,
        startLabel: getRangeLabel(rangeHighlight.startDate, mode),
        width: Math.abs(end - start),
      }
    }, [mode, origin, rangeHighlight])

    return (
      <div
        ref={ref}
        data-testid="timeline-header"
        className="sticky top-0 z-30 border-b border-border/70 bg-background/95 shadow-[0_1px_0_rgb(0_0_0/0.03),0_8px_20px_rgb(0_0_0/0.025)] backdrop-blur-xl select-none"
        style={{ width: totalWidth, minWidth: totalWidth }}
      >
        <div
          className="relative h-8 border-b border-border/50 bg-muted/15"
          data-testid="header-primary"
        >
          {groups.map((group) => (
            <div
              key={`${group.label}-${group.left}`}
              className="absolute top-0 h-full border-r border-border/30 px-3"
              style={{ left: group.left, width: group.width }}
              data-testid="header-primary-group"
            >
              <span className="sticky left-3 inline-flex h-full items-center text-[10px] font-semibold tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase">
                {group.label}
              </span>
            </div>
          ))}
        </div>

        <div className="relative h-7" data-testid="header-secondary">
          {cells.map((cell) => (
            <div
              key={`${cell.date.getTime()}-${cell.left}`}
              className={cn(
                "absolute top-0 flex h-full items-center justify-center text-[10px] font-medium text-muted-foreground",
                (mode === "hours" ||
                  mode === "day" ||
                  mode === "week" ||
                  mode === "bi-week") &&
                  "border-r border-border/20",
                cell.isWeekend && "bg-muted/20 text-muted-foreground/70"
              )}
              style={{ left: cell.left, width: cell.width }}
              data-testid="header-secondary-cell"
              data-weekend={cell.isWeekend || undefined}
            >
              {cell.label}
            </div>
          ))}

          <TimelineTodayHeaderMarker
            columnWidth={columnWidth}
            mode={mode}
            origin={origin}
          />

          {highlightedRange && (
            <div
              className="pointer-events-none absolute inset-y-0 z-20 border-x border-foreground/20 bg-foreground/[0.055]"
              style={{
                left: highlightedRange.left,
                width: Math.max(1, highlightedRange.width),
              }}
              data-testid="header-range-highlight"
            />
          )}
        </div>

        {highlightedRange && (
          <>
            <div
              className="pointer-events-none absolute top-8 z-30 h-7 border-l border-foreground/30"
              style={{ left: highlightedRange.start }}
            >
              <span
                className={cn(
                  "absolute top-1/2 right-1 -translate-y-1/2 rounded border border-border/70 bg-background/95 px-1.5 py-0.5 text-[9px] leading-none whitespace-nowrap text-muted-foreground shadow-sm",
                  highlightedRange.activeEdge === "start" &&
                    "border-foreground/30 text-foreground"
                )}
                data-testid="header-range-start"
              >
                {highlightedRange.startLabel}
              </span>
            </div>
            <div
              className="pointer-events-none absolute top-8 z-30 h-7 border-l border-foreground/30"
              style={{ left: highlightedRange.end }}
            >
              <span
                className={cn(
                  "absolute top-1/2 left-1 -translate-y-1/2 rounded border border-border/70 bg-background/95 px-1.5 py-0.5 text-[9px] leading-none whitespace-nowrap text-muted-foreground shadow-sm",
                  highlightedRange.activeEdge === "end" &&
                    "border-foreground/30 text-foreground"
                )}
                data-testid="header-range-end"
              >
                {highlightedRange.endLabel}
              </span>
            </div>
          </>
        )}
      </div>
    )
  })
)
