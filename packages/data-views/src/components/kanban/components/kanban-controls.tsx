import React from "react"
import { useKanbanConfig } from "../context/kanban-config-context.js"
import { useKanbanCommandActions } from "../hooks/use-kanban-command-actions.js"
import { useKanbanStore } from "../hooks/use-kanban-store.js"
import {
  selectKanbanSelectedCount,
  selectKanbanSelection,
} from "../store/selectors.js"
import { Button } from "../../ui/button.js"
import { cn } from "../../../lib/utils.js"

interface Props extends React.ComponentProps<"div"> {
  readonly visibleOrder: readonly string[]
}

/** Contextual actions only. Global search and settings belong to DatabaseViews. */
export const KanbanControls = React.memo(
  React.forwardRef<HTMLDivElement, Props>(function KanbanControls(
    { visibleOrder, className, ...props },
    ref
  ) {
    const config = useKanbanConfig()
    const commands = useKanbanCommandActions()
    const selectedCount = useKanbanStore(selectKanbanSelectedCount)
    const selectedIds = useKanbanStore(selectKanbanSelection)
    if (selectedCount === 0) return null

    const selectedVisible = visibleOrder.filter((id) => selectedIds.has(id))
    return (
      <div
        ref={ref}
        role="toolbar"
        aria-label="Selected card actions"
        className={cn(
          "flex min-h-9 items-center gap-2 border-b border-border/60 bg-muted/20 px-2 py-1",
          className
        )}
        {...props}
      >
        <span className="text-xs font-medium">{selectedCount} selected</span>
        {config.renderBulkAction?.([...selectedIds])}
        {!config.readOnly && config.onCommand ? (
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => commands.duplicateCards(selectedVisible)}
            >
              Duplicate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => commands.deleteCards(selectedVisible)}
            >
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    )
  })
)
