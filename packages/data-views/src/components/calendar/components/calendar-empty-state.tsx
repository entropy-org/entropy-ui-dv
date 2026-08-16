import React from "react"
import { CalendarRange, SearchX } from "lucide-react"
import { useCalendarConfig } from "../context/calendar-config-context.js"
import { cn } from "../../../lib/utils.js"

export type CalendarEmptyStateProps = React.ComponentProps<"div"> & {
  readonly searchQuery?: string
}

export const CalendarEmptyState = React.memo(
  React.forwardRef<HTMLDivElement, CalendarEmptyStateProps>(
    function CalendarEmptyState({ searchQuery, className, ...props }, ref) {
      const { renderEmptyState } = useCalendarConfig()
      if (!searchQuery && renderEmptyState) return renderEmptyState()
      const Icon = searchQuery ? SearchX : CalendarRange
      return (
        <div
          ref={ref}
          className={cn(
            "flex min-h-72 flex-1 items-center justify-center p-8 text-center",
            className
          )}
          data-testid={
            searchQuery ? "calendar-search-empty-state" : "calendar-empty-state"
          }
          {...props}
        >
          <div className="flex max-w-sm flex-col items-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border bg-background text-primary shadow-sm">
              <Icon className="size-6" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold">
              {searchQuery ? "No matching events" : "Nothing scheduled yet"}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              {searchQuery
                ? `No events match “${searchQuery}”. Try another search.`
                : "Click or drag across a date to create your first event."}
            </p>
          </div>
        </div>
      )
    }
  )
)
