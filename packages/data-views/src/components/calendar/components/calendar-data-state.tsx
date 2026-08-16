import React from "react"
import type { CalendarDataPresentation } from "../types.js"
import { cn } from "../../../lib/utils.js"

export type CalendarDataStateProps = React.ComponentProps<"div"> & {
  readonly state: CalendarDataPresentation
  readonly onRetry?: () => void
}

function defaultMessage(state: CalendarDataPresentation): string | null {
  if (state.status === "loading" || state.status === "stale") {
    return "Loading calendar data…"
  }
  if (state.status === "refreshing") {
    return state.partial
      ? "Refreshing calendar data; some events are not loaded yet."
      : "Refreshing calendar data…"
  }
  if (state.status === "error") {
    return state.blocksContent
      ? "Calendar data could not be loaded."
      : "Calendar data could not be refreshed. Showing the last available events."
  }
  return state.partial ? "Some events are not loaded yet." : null
}

export const CalendarDataState = React.memo(
  React.forwardRef<HTMLDivElement, CalendarDataStateProps>(
    function CalendarDataState({ state, onRetry, className, ...props }, ref) {
      const message = defaultMessage(state)
      if (!message) return null
      return (
        <div
          ref={ref}
          role={state.status === "error" ? "alert" : "status"}
          aria-live={state.status === "error" ? "assertive" : "polite"}
          className={cn(
            "flex shrink-0 items-center justify-center gap-2 border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground",
            state.blocksContent && "min-h-40 flex-1 border-b-0",
            state.status === "error" && "text-destructive",
            className
          )}
          data-testid="calendar-data-state"
          {...props}
        >
          <span>{message}</span>
          {state.status === "error" && onRetry ? (
            <button
              type="button"
              className="rounded border px-2 py-1 text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              onClick={onRetry}
            >
              Retry
            </button>
          ) : null}
        </div>
      )
    }
  )
)
