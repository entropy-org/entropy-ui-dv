import React from "react"
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  LocateFixed,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react"
import { useCalendarConfig } from "../context/calendar-config-context.js"
import { useCalendarCommandActions } from "../hooks/use-calendar-command-actions.js"
import { useCalendarNavigationActions } from "../hooks/use-calendar-navigation.js"
import { useCalendarStore } from "../hooks/use-calendar-store.js"
import {
  selectActions,
  selectCanRedo,
  selectCanUndo,
  selectSearchQuery,
  selectSelectedCount,
} from "../store/selectors.js"
import { Button } from "../../ui/button.js"
import { cn } from "../../../lib/utils.js"
import { CalendarSearch } from "./calendar-search.js"
import { CalendarSettings } from "./calendar-settings.js"
import { CalendarViewSelect } from "./calendar-view-select.js"
import { CalendarAgendaSpanSelect } from "./agenda/calendar-agenda-span-select.js"
import { canMutateCalendarItem } from "../utils/data-integration.js"
import { useSelectedCalendarIds } from "../hooks/use-calendar-selectors.js"

export type CalendarControlsProps = React.ComponentProps<"div"> & {
  readonly itemCount: number
  readonly title: string
}

export const CalendarControls = React.memo(
  React.forwardRef<HTMLDivElement, CalendarControlsProps>(
    function CalendarControls({ itemCount, title, className, ...props }, ref) {
      const config = useCalendarConfig()
      const navigation = useCalendarNavigationActions()
      const commands = useCalendarCommandActions()
      const searchQuery = useCalendarStore(selectSearchQuery)
      const selectedCount = useCalendarStore(selectSelectedCount)
      const selectedIds = useSelectedCalendarIds()
      const canUndo = useCalendarStore(selectCanUndo)
      const canRedo = useCalendarStore(selectCanRedo)
      const actions = useCalendarStore(selectActions)
      const selectionEnabled = config.selection?.mode !== "none"
      const canDeleteSelection =
        selectionEnabled &&
        selectedIds.length > 0 &&
        selectedIds.every((itemId) => {
          const item = config.items.find((candidate) => candidate.id === itemId)
          return item && canMutateCalendarItem(config, item, "delete")
        })
      const historyWritable =
        !config.readOnly &&
        config.permissions?.update !== false &&
        config.permissions?.delete !== false

      return (
        <div
          ref={ref}
          className={cn(
            "flex min-h-14 w-full items-center justify-between gap-3 border-b px-4 py-2",
            className
          )}
          data-testid="calendar-controls"
          {...props}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
              <CalendarRange className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1
                className="truncate text-sm font-semibold"
                data-testid="calendar-title"
              >
                {title}
              </h1>
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
          <div className="flex items-center gap-1.5">
            <CalendarSearch
              value={searchQuery}
              onValueChange={actions.setSearchQuery}
            />
            {canDeleteSelection ? (
              <Button
                variant="outline"
                size="icon-lg"
                onClick={commands.deleteSelected}
                aria-label="Delete selected items"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            ) : null}
            {historyWritable ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  disabled={!canUndo}
                  onClick={commands.undo}
                  aria-label="Undo"
                >
                  <Undo2 aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  disabled={!canRedo}
                  onClick={commands.redo}
                  aria-label="Redo"
                >
                  <Redo2 aria-hidden="true" />
                </Button>
              </>
            ) : null}
            <div className="flex items-center rounded-lg border bg-background shadow-xs">
              <Button
                variant="ghost"
                size="icon-lg"
                onClick={navigation.previous}
                aria-label="Previous period"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="default" onClick={navigation.today}>
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
            </div>
            <CalendarViewSelect />
            {config.preferences.viewMode === "agenda" ? (
              <CalendarAgendaSpanSelect />
            ) : null}
            <CalendarSettings />
          </div>
        </div>
      )
    }
  )
)
