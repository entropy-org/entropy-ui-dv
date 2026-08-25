import React from "react"
import { useTimelineStore } from "../hooks/use-timeline-store.js"
import { Button } from "../../ui/button.js"
import { LocateFixed } from "lucide-react"
import { TimelineViewportSelect } from "./timeline-viewport-select.js"
import { cn } from "../../../lib/utils.js"

/**
 * Required engine header containing timeline-only navigation.
 * Global search and settings belong to DatabaseViews.
 */
export const TimelineControls = React.memo(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    function TimelineControls({ className, ...props }, ref) {
      const scrollToToday = useTimelineStore((s) => s.actions.scrollToToday)
      const itemCount = useTimelineStore((s) => s.items.size)
      const selectedCount = useTimelineStore((s) => s.selectedIds.size)
      return (
        <div
          ref={ref}
          className={cn(
            "flex min-h-8 w-full items-center justify-between gap-3",
            className
          )}
          data-testid="timeline-controls"
          {...props}
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs leading-4 font-semibold">
                Timeline
              </p>
              <p
                className="truncate text-[10px] leading-3.5 text-muted-foreground"
                aria-live="polite"
              >
                {selectedCount > 0
                  ? `${selectedCount} selected`
                  : `${itemCount} ${itemCount === 1 ? "item" : "items"}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={scrollToToday}
              data-testid="timeline-today-btn"
            >
              <LocateFixed data-icon="inline-start" aria-hidden="true" />
              Today
            </Button>

            <TimelineViewportSelect />
          </div>
        </div>
      )
    }
  )
)
