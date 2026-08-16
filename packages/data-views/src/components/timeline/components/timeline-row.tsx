/**
 * TimelineRow — positioned container for a single timeline row.
 *
 * Absolutely positioned within TimelineGrid at the correct vertical
 * offset. Holds the bar(s) for one item.
 */
import React, { useMemo } from "react"

interface TimelineRowProps {
  /** Row index (0-based) */
  index: number
  /** Height of each row in pixels */
  rowHeight: number
  /** Row content (bars) */
  children?: React.ReactNode
  /** Item represented by this row, used as a dependency drop target. */
  itemId?: string
}

/**
 * Row container positioned absolutely within the grid.
 */
export const TimelineRow = React.memo(
  React.forwardRef<HTMLDivElement, TimelineRowProps>(function TimelineRow(
    { index, rowHeight, itemId, children },
    ref
  ) {
    const style = useMemo(
      () => ({ top: index * rowHeight, height: rowHeight }),
      [index, rowHeight]
    )

    return (
      <div
        ref={ref}
        data-testid={`timeline-row-${index}`}
        data-timeline-row-item-id={itemId}
        className="absolute w-full transition-colors duration-100 data-[dependency-target=true]:bg-amber-500/10"
        style={style}
      >
        {children}
      </div>
    )
  })
)
