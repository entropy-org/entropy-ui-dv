import React from "react"
import { SearchX } from "lucide-react"
import { Button } from "../../ui/button.js"
import { cn } from "../../../lib/utils.js"

type TimelineSearchEmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  query: string
  onClear: () => void
}

export const TimelineSearchEmptyState = React.memo(
  React.forwardRef<HTMLDivElement, TimelineSearchEmptyStateProps>(
    function TimelineSearchEmptyState(
      { query, onClear, className, ...props },
      ref
    ) {
      return (
        <div
          ref={ref}
          className={cn(
            "flex min-h-72 flex-1 items-center justify-center bg-muted/5 p-8",
            className
          )}
          data-testid="timeline-search-empty-state"
          {...props}
        >
          <div className="flex max-w-sm flex-col items-center text-center">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl border border-border/80 bg-background text-muted-foreground shadow-xs">
              <SearchX className="size-4.5" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold">No matching rows</p>
            <p className="mt-1 max-w-72 truncate text-xs text-muted-foreground">
              Nothing matched “{query}”
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClear}
              className="mt-4 bg-background shadow-xs"
            >
              Clear search
            </Button>
          </div>
        </div>
      )
    }
  )
)
