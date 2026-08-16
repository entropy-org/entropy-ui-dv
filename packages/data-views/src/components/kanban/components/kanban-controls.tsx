import React from "react"
import { Columns3, Copy, Redo2, Trash2, Undo2 } from "lucide-react"
import { useKanbanConfig } from "../context/kanban-config-context.js"
import { useKanbanCommandActions } from "../hooks/use-kanban-command-actions.js"
import { useKanbanStore } from "../hooks/use-kanban-store.js"
import {
  selectKanbanActions,
  selectKanbanCanRedo,
  selectKanbanCanUndo,
  selectKanbanSearchQuery,
  selectKanbanSelectedCount,
  selectKanbanSelection,
} from "../store/selectors.js"
import { Button } from "../../ui/button.js"
import { KanbanSearch } from "./kanban-search.js"
import { KanbanSettings } from "./kanban-settings.js"
import { cn } from "../../../lib/utils.js"

interface Props extends React.ComponentProps<"div"> {
  readonly itemCount: number
  readonly resultCount: number
  readonly visibleOrder: readonly string[]
  readonly onPreviousResult: () => void
  readonly onNextResult: () => void
}

export const KanbanControls = React.memo(
  React.forwardRef<HTMLDivElement, Props>(function KanbanControls(
    {
      itemCount,
      resultCount,
      visibleOrder,
      onPreviousResult,
      onNextResult,
      className,
      ...props
    },
    ref
  ) {
    const config = useKanbanConfig()
    const commands = useKanbanCommandActions()
    const actions = useKanbanStore(selectKanbanActions)
    const selectedCount = useKanbanStore(selectKanbanSelectedCount)
    const selectedIds = useKanbanStore(selectKanbanSelection)
    const query = useKanbanStore(selectKanbanSearchQuery)
    const canUndo = useKanbanStore(selectKanbanCanUndo)
    const canRedo = useKanbanStore(selectKanbanCanRedo)
    const selectionEnabled = config.selection?.mode !== "none"
    const selectedVisible = visibleOrder.filter((id) => selectedIds.has(id))
    const changeSearch = (value: string) => {
      actions.setSearchQuery(value)
      if (config.search?.mode === "server" || config.search?.mode === "hybrid")
        config.search.onQueryChange(value)
    }
    return (
      <div
        ref={ref}
        className={cn(
          "flex min-h-14 items-center justify-between gap-3 border-b px-4 py-2",
          className
        )}
        {...props}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
            <Columns3 className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">Kanban</h1>
            <p className="text-[10px] text-muted-foreground" aria-live="polite">
              {selectionEnabled && selectedCount > 0
                ? `${selectedCount} selected`
                : `${itemCount} ${itemCount === 1 ? "card" : "cards"}`}
            </p>
          </div>
          {config.renderHeaderAction?.()}
        </div>
        <div className="flex items-center gap-1.5">
          <KanbanSearch
            value={query}
            resultCount={resultCount}
            pending={
              config.search?.mode !== "local" && config.search?.isPending
            }
            onChange={changeSearch}
            onPrevious={onPreviousResult}
            onNext={onNextResult}
          />
          {selectionEnabled && selectedCount > 0 ? (
            <div
              role="toolbar"
              aria-label="Selected card actions"
              className="flex items-center gap-1 rounded-lg border bg-background px-1 py-0.5"
            >
              {config.renderBulkAction?.([...selectedIds])}
              {!config.readOnly && config.onCommand ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => commands.duplicateCards(selectedVisible)}
                    aria-label="Duplicate selected cards"
                  >
                    <Copy aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => commands.deleteCards(selectedVisible)}
                    aria-label="Delete selected cards"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
          {!config.readOnly && config.onCommand ? (
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
          <KanbanSettings />
        </div>
      </div>
    )
  })
)
