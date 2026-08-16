import React from "react"
import { Search, X } from "lucide-react"
import { Button } from "../../ui/button.js"
import { cn } from "../../../lib/utils.js"

export interface DataListControlsProps extends React.ComponentPropsWithoutRef<"div"> {
  readonly query: string
  readonly placeholder?: string
  readonly resultCount: number
  readonly totalCount: number
  readonly loadedCount?: number
  readonly pending?: boolean
  readonly searchDisabled?: boolean
  readonly selectedCount?: number
  readonly bulkActions?: React.ReactNode
  readonly customControls?: React.ReactNode
  readonly onQueryChange: (query: string) => void
  readonly onClearSelection?: () => void
}

export const DataListControls = React.forwardRef<
  HTMLDivElement,
  DataListControlsProps
>(function DataListControls(
  {
    query,
    placeholder = "Search records…",
    resultCount,
    totalCount,
    loadedCount = resultCount,
    pending,
    searchDisabled,
    selectedCount = 0,
    bulkActions,
    customControls,
    onQueryChange,
    onClearSelection,
    className,
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex min-h-11 items-center gap-2 border-b border-border/60 px-2 py-1.5",
        className
      )}
      data-list-part="controls"
      {...props}
    >
      <div className="relative max-w-72 min-w-44 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="h-8 w-full min-w-0 rounded-md border border-transparent bg-muted/40 pr-8 pl-8 text-xs shadow-none outline-none placeholder:text-muted-foreground focus-visible:border-border focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={placeholder}
          aria-label="Search list"
          disabled={searchDisabled}
        />
        {query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-0.5 size-7 -translate-y-1/2"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <span
        className="shrink-0 text-xs text-muted-foreground"
        aria-live="polite"
      >
        {pending
          ? "Updating…"
          : loadedCount < resultCount
            ? `${loadedCount} loaded · ${resultCount} matching`
            : `${resultCount} of ${totalCount}`}
      </span>
      {selectedCount > 0 ? (
        <div className="flex items-center gap-1.5 border-l border-border/60 pl-2">
          <span className="text-xs font-medium">{selectedCount} selected</span>
          {bulkActions}
          {onClearSelection ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onClearSelection}
            >
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}
      {customControls}
    </div>
  )
})
