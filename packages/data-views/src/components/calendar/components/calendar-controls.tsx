import React from "react"
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  LocateFixed,
} from "lucide-react"
import { useCalendarConfig } from "../context/calendar-config-context.js"
import { useCalendarNavigationActions } from "../hooks/use-calendar-navigation.js"
import { useCalendarStore } from "../hooks/use-calendar-store.js"
import { selectSelectedCount } from "../store/selectors.js"
import { Button } from "../../ui/button.js"
import { cn } from "../../../lib/utils.js"
import { CalendarViewSelect } from "./calendar-view-select.js"
import { CalendarAgendaSpanSelect } from "./agenda/calendar-agenda-span-select.js"

export type CalendarControlsProps = React.ComponentProps<"div"> & {
  readonly itemCount: number
  readonly title: string
}

/** Calendar-only navigation. Search, New, and settings belong to DatabaseViews. */
export const CalendarControls = React.memo(
  React.forwardRef<HTMLDivElement, CalendarControlsProps>(
    function CalendarControls({ itemCount, title, className, ...props }, ref) {
      const config = useCalendarConfig()
      const navigation = useCalendarNavigationActions()
      const selectedCount = useCalendarStore(selectSelectedCount)
      const selectionEnabled = config.selection?.mode !== "none"

      return (
        <div
          ref={ref}
          className={cn(
            "flex min-h-11 w-full items-center justify-between gap-3 border-b border-border/60 px-3 py-1.5",
            className
          )}
          data-testid="calendar-controls"
          {...props}
        >
          <div className="flex min-w-0 items-center gap-2">
            <CalendarRange
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2
                className="truncate text-xs font-semibold"
                data-testid="calendar-title"
              >
                {title}
              </h2>
              <p
                className="truncate text-[10px] text-muted-foreground"
                aria-live="polite"
              >
                {selectionEnabled && selectedCount > 0
                  ? `${selectedCount} selected`
                  : `${itemCount} ${itemCount === 1 ? "item" : "items"}`}
              </p>
            </div>
            {config.renderHeaderAction?.()}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-lg"
              onClick={navigation.previous}
              aria-label="Previous period"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={navigation.today}
              aria-label="Go to today"
            >
              <LocateFixed data-icon="inline-start" aria-hidden="true" />
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              onClick={navigation.next}
              aria-label="Next period"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
            <CalendarViewSelect />
            {config.preferences.viewMode === "agenda" ? (
              <CalendarAgendaSpanSelect />
            ) : null}
          </div>
        </div>
      )
    }
  )
)
