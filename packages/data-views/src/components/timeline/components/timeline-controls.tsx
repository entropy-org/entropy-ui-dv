import React from "react"
import { useTimelineStore } from "../hooks/use-timeline-store.js"
import { Button } from "../../ui/button.js"
import { CalendarRange, LocateFixed } from "lucide-react"
import { TimelineSettings } from "./timeline-settings.js"
import { TimelineViewportSelect } from "./timeline-viewport-select.js"
import { TimelineSearch } from "./timeline-search.js"
import { cn } from "../../../lib/utils.js"

/**
 * Primary timeline actions and the entry point for view settings.
 * Meant to be placed above the timeline or in a header.
 */
export const TimelineControls = React.memo(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    function TimelineControls({ className, ...props }, ref) {
      const scrollToToday = useTimelineStore((s) => s.actions.scrollToToday)
      const itemCount = useTimelineStore((s) => s.items.size)
      const selectedCount = useTimelineStore((s) => s.selectedIds.size)
      const searchQuery = useTimelineStore((s) => s.searchQuery)
      const setSearchQuery = useTimelineStore((s) => s.actions.setSearchQuery)
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
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
              <CalendarRange className="size-4" aria-hidden="true" />
            </div>
            <div className="hidden min-w-0 sm:block">
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
            <TimelineSearch
              value={searchQuery}
              onValueChange={setSearchQuery}
              onClear={() => setSearchQuery("")}
            />

            <Button
              variant="outline"
              size="default"
              onClick={scrollToToday}
              data-testid="timeline-today-btn"
              className="bg-background shadow-xs"
            >
              <LocateFixed data-icon="inline-start" aria-hidden="true" />
              Today
            </Button>

            <TimelineViewportSelect />
            <TimelineSettings />
          </div>
        </div>
      )
    }
  )
)
