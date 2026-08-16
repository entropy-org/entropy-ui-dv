import React from "react"
import { CalendarRange, Plus } from "lucide-react"
import { useTimelineConfig } from "../context/timeline-config-context.js"
import { cn } from "../../../lib/utils.js"
import { TimelineRendererBoundary } from "./timeline-renderer-boundary.js"

type TimelineEmptyStateProps = React.HTMLAttributes<HTMLDivElement>

/**
 * Configurable empty state shown when the timeline has no items.
 */
export const TimelineEmptyState = React.memo(
  React.forwardRef<HTMLDivElement, TimelineEmptyStateProps>(
    function TimelineEmptyState({ className, ...props }, ref) {
      const { renderEmptyState, onItemAdd, onMutation } = useTimelineConfig()
      const canCreate = Boolean(onItemAdd || onMutation)

      return (
        <div
          ref={ref}
          data-testid="timeline-empty-state"
          className={cn(
            "relative flex min-h-72 flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,var(--color-muted)_0,transparent_68%)] p-8",
            className
          )}
          {...props}
        >
          {renderEmptyState ? (
            <TimelineRendererBoundary surface="empty">
              {renderEmptyState}
            </TimelineRendererBoundary>
          ) : (
            <div className="flex max-w-sm flex-col items-center text-center">
              <div className="relative mb-5">
                <div className="absolute inset-0 scale-150 rounded-full bg-primary/10 blur-xl" />
                <div className="relative flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-background shadow-sm">
                  <CalendarRange
                    className="size-6 text-primary"
                    aria-hidden="true"
                  />
                </div>
              </div>
              <h2 className="text-base font-semibold tracking-tight">
                No work scheduled yet
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                {canCreate
                  ? "Move over the timeline and click a date to create your first item."
                  : "Add an item to start shaping your project schedule."}
              </p>
              {canCreate && (
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                  <Plus className="size-3.5 text-primary" aria-hidden="true" />
                  Click any date to add work
                </div>
              )}
            </div>
          )}
        </div>
      )
    }
  )
)
