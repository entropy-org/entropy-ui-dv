import React from "react"
import type { CalendarDateGridRow } from "../utils/date-grid.js"
import { cn } from "../../../lib/utils.js"

export type CalendarWeekdayHeaderProps = React.ComponentProps<"div"> & {
  readonly row: CalendarDateGridRow
}

export const CalendarWeekdayHeader = React.memo(
  React.forwardRef<HTMLDivElement, CalendarWeekdayHeaderProps>(
    function CalendarWeekdayHeader({ row, className, ...props }, ref) {
      return (
        <div
          ref={ref}
          role="presentation"
          className={cn(
            "sticky top-0 z-20 grid h-8 shrink-0 border-b bg-background/95 backdrop-blur",
            className
          )}
          style={{
            gridTemplateColumns: `repeat(${row.visibleCells.length}, minmax(0, 1fr))`,
          }}
          data-testid="calendar-weekday-header"
          {...props}
        >
          {row.visibleCells.map((cell) => (
            <div
              key={cell.date}
              role="presentation"
              className="flex items-center justify-center border-r text-[10px] font-semibold tracking-wide text-muted-foreground uppercase last:border-r-0"
            >
              {cell.weekdayLabel}
            </div>
          ))}
        </div>
      )
    }
  )
)
