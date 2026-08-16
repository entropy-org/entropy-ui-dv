import React, { useId, useMemo } from "react"
import { useTimelineStore } from "../hooks/use-timeline-store.js"
import type { DisplayRow } from "../hooks/use-display-rows.js"
import {
  createTimelineLinkPreview,
  getTimelineLinkPosition,
  isTimelineLinkItemLive,
} from "../utils/link-preview.js"
import { cn } from "../../../lib/utils.js"

interface TimelineHierarchyLayerProps {
  origin: Date
  displayRows: DisplayRow[]
  contentHeight: number
  contentWidth: number
}

/**
 * Compact file-tree indicators for nested child rows.
 *
 * The old parent-to-child routes crossed the timeline and competed with real
 * dependencies. These small elbow arrows live beside each child bar instead,
 * preserving hierarchy context without adding another connection network.
 */
export const TimelineHierarchyLayer = React.memo(
  React.forwardRef<SVGSVGElement, TimelineHierarchyLayerProps>(
    function TimelineHierarchyLayer(
      { origin, displayRows, contentHeight, contentWidth },
      ref
    ) {
      const rowSubItemMode = useTimelineStore((s) => s.rowSubItemMode)
      const viewportMode = useTimelineStore((s) => s.viewportMode)
      const rowHeight = useTimelineStore((s) => s.rowHeight)
      const scrollLeft = useTimelineStore((s) => s.scrollLeft)
      const viewportWidth = useTimelineStore((s) => s.viewportWidth)
      const items = useTimelineStore((s) => s.items)
      const dragState = useTimelineStore((s) => s.dragState)
      const rangeHighlight = useTimelineStore((s) => s.rangeHighlight)
      const labelId = `timeline-tree-label-${useId().replaceAll(":", "")}`

      const linkPreview = useMemo(
        () =>
          createTimelineLinkPreview(
            items,
            rangeHighlight,
            dragState,
            origin,
            viewportMode
          ),
        [dragState, items, origin, rangeHighlight, viewportMode]
      )

      const indicators = useMemo(() => {
        if (rowSubItemMode !== "nested") return []

        const viewportRight = scrollLeft + viewportWidth
        return displayRows.flatMap((row, rowIndex) => {
          const parentId = row.item.parentId
          if (!parentId || row.depth === 0) return []

          const child = items.get(row.item.id)
          if (!child) return []
          const position = getTimelineLinkPosition(
            linkPreview,
            child.id,
            child,
            origin,
            viewportMode
          )
          const isVisible =
            position.left <= viewportRight &&
            position.left + position.width >= scrollLeft
          if (!isVisible) return []

          return [
            {
              id: `${parentId}:${child.id}`,
              parentId,
              childId: child.id,
              x: position.left - 18,
              y: rowIndex * rowHeight + rowHeight / 2 - 6,
              isLive: isTimelineLinkItemLive(linkPreview, child.id),
            },
          ]
        })
      }, [
        displayRows,
        items,
        linkPreview,
        origin,
        rowHeight,
        rowSubItemMode,
        scrollLeft,
        viewportMode,
        viewportWidth,
      ])

      if (indicators.length === 0) return null

      return (
        <svg
          ref={ref}
          data-testid="timeline-hierarchy-layer"
          className="pointer-events-none absolute inset-0 z-10 overflow-visible"
          style={{ width: contentWidth, height: contentHeight }}
          aria-labelledby={labelId}
        >
          <title id={labelId}>Nested item indicators</title>
          {indicators.map((indicator) => (
            <g
              key={indicator.id}
              transform={`translate(${indicator.x} ${indicator.y})`}
              data-testid={`hierarchy-indicator-${indicator.parentId}-${indicator.childId}`}
              data-live={indicator.isLive || undefined}
              className={cn(
                "text-muted-foreground/45 transition-colors duration-150",
                indicator.isLive && "text-foreground/65"
              )}
            >
              <path
                d="M 2 1 V 5.25 C 2 7.25 3.5 8.75 5.5 8.75 H 12"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.25}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M 9.25 6.25 L 12 8.75 L 9.25 11.25"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </svg>
      )
    }
  )
)
