import React, { useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTimelineConfig } from "../context/timeline-config-context.js"
import type { DisplayRow } from "../hooks/use-display-rows.js"
import { useTimelineStore } from "../hooks/use-timeline-store.js"
import { getBarPosition } from "../utils/position-utils.js"

interface TimelineOffscreenIndicatorProps {
  displayRows: DisplayRow[]
  headerHeight: number
  origin: Date
}

type RowIndicator = {
  direction: "left" | "right"
  item: DisplayRow["item"]
  rowIndex: number
  targetDate: Date
}

export const TimelineOffscreenIndicator = React.memo(
  function TimelineOffscreenIndicator({
    displayRows,
    headerHeight,
    origin,
  }: TimelineOffscreenIndicatorProps) {
    const { renderTooltip } = useTimelineConfig()
    const mode = useTimelineStore((s) => s.viewportMode)
    const rowHeight = useTimelineStore((s) => s.rowHeight)
    const scrollLeft = useTimelineStore((s) => s.scrollLeft)
    const scrollTop = useTimelineStore((s) => s.scrollTop)
    const viewportWidth = useTimelineStore((s) => s.viewportWidth)
    const viewportHeight = useTimelineStore((s) => s.viewportHeight)
    const scrollToDate = useTimelineStore((s) => s.actions.scrollToDate)

    const indicators = useMemo(() => {
      if (viewportWidth <= 0) return []

      const visibleRight = scrollLeft + viewportWidth

      return displayRows.flatMap<RowIndicator>((row, rowIndex) => {
        const startDate = row.item.startDate
        const endDate = row.item.endDate
        const bar = getBarPosition(startDate, endDate, origin, mode)
        const barRight = bar.left + bar.width

        if (barRight < scrollLeft) {
          return [
            {
              direction: "left",
              item: row.item,
              rowIndex,
              targetDate: startDate,
            },
          ]
        }

        if (bar.left > visibleRight) {
          return [
            {
              direction: "right",
              item: row.item,
              rowIndex,
              targetDate: startDate,
            },
          ]
        }

        return []
      })
    }, [displayRows, mode, origin, scrollLeft, viewportWidth])

    return (
      <div
        className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
        data-testid="timeline-offscreen-indicators"
      >
        {indicators.map((indicator) => {
          const top =
            headerHeight +
            indicator.rowIndex * rowHeight -
            scrollTop +
            rowHeight / 2
          if (
            top < headerHeight + 10 ||
            top > Math.max(headerHeight, viewportHeight) - 10
          ) {
            return null
          }

          const isLeft = indicator.direction === "left"
          const title =
            (indicator.item.data as { title?: string })?.title ??
            indicator.item.id
          const navigate = () => scrollToDate(indicator.targetDate)
          const handleContentKeyDown = (
            event: React.KeyboardEvent<HTMLDivElement>
          ) => {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            navigate()
          }

          return (
            <div
              key={`${indicator.direction}-${indicator.item.id}`}
              className={`group pointer-events-auto absolute flex h-12 w-14 -translate-y-1/2 items-center justify-center ${
                isLeft ? "left-0" : "right-0"
              }`}
              style={{ top }}
              data-testid={`timeline-offscreen-${indicator.direction}-${indicator.item.id}`}
            >
              <button
                type="button"
                className="flex size-5 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted-foreground shadow-sm backdrop-blur-md transition-[color,background-color,transform,box-shadow] duration-150 hover:scale-105 hover:bg-background hover:text-foreground hover:shadow-md active:scale-95"
                aria-label={`Show ${title}`}
                onClick={navigate}
              >
                {isLeft ? (
                  <ChevronLeft className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
              </button>

              <div
                className={`pointer-events-none invisible absolute top-1/2 z-40 min-w-max -translate-y-1/2 cursor-pointer rounded-md border border-border/70 bg-popover/95 px-2.5 py-1.5 text-xs text-popover-foreground opacity-0 shadow-lg backdrop-blur-xl transition-[opacity,transform] duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:translate-x-0 group-hover:opacity-100 ${
                  isLeft
                    ? "left-full -translate-x-1"
                    : "right-full translate-x-1"
                }`}
                role="button"
                tabIndex={0}
                aria-label={`Show ${title}`}
                data-testid={`timeline-offscreen-content-${indicator.item.id}`}
                onClick={navigate}
                onKeyDown={handleContentKeyDown}
              >
                {renderTooltip ? (
                  renderTooltip(indicator.item)
                ) : (
                  <>
                    <div className="font-medium">{title}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {indicator.item.startDate.toLocaleDateString()} –{" "}
                      {indicator.item.endDate.toLocaleDateString()}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }
)
