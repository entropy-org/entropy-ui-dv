import React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import type { CalendarDateGridCell } from "../utils/date-grid.js"
import { cn } from "../../../lib/utils.js"

const dayCellVariants = cva(
  "relative min-h-0 border-r border-b bg-background text-left outline-none last:border-r-0 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset motion-reduce:transition-none forced-colors:border-[CanvasText]",
  {
    variants: {
      currentMonth: { true: "", false: "bg-muted/20 text-muted-foreground" },
      today: { true: "bg-primary/[0.035]", false: "" },
      creating: { true: "bg-primary/10", false: "" },
    },
    defaultVariants: { currentMonth: true, today: false, creating: false },
  }
)

export type CalendarDayCellProps = Omit<
  React.ComponentProps<"button">,
  "children"
> &
  VariantProps<typeof dayCellVariants> & {
    readonly cell: CalendarDateGridCell
    readonly dateLabel?: string
    readonly showWeekday?: boolean
  }

export const CalendarDayCell = React.memo(
  React.forwardRef<HTMLButtonElement, CalendarDayCellProps>(
    function CalendarDayCell(
      {
        cell,
        dateLabel,
        currentMonth,
        today,
        creating,
        showWeekday = false,
        className,
        ...props
      },
      ref
    ) {
      return (
        <button
          ref={ref}
          type="button"
          role="gridcell"
          className={cn(
            dayCellVariants({ currentMonth, today, creating }),
            className
          )}
          data-calendar-date={cell.date}
          aria-label={`${cell.weekdayLabel}, ${cell.date}`}
          aria-current={today ? "date" : undefined}
          {...props}
        >
          <span className="absolute top-1 right-1 left-1 flex items-center justify-center gap-1 text-[11px] font-medium">
            {showWeekday ? (
              <span className="text-muted-foreground">{cell.weekdayLabel}</span>
            ) : null}
            <span
              className={cn(
                "flex h-6 min-w-6 items-center justify-center rounded-full px-1",
                today && "bg-primary font-semibold text-primary-foreground"
              )}
            >
              {dateLabel ?? cell.dayOfMonth}
            </span>
          </span>
        </button>
      )
    }
  )
)
