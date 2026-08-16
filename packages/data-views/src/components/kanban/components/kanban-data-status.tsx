import React from "react"
import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react"
import { Button } from "../../ui/button.js"
import type { KanbanDataState } from "../types.js"
import { cn } from "../../../lib/utils.js"

interface KanbanDataStatusProps extends React.ComponentProps<"div"> {
  readonly state: Exclude<KanbanDataState, { readonly status: "loading" }>
  readonly onRetry?: () => void
}

export const KanbanDataStatus = React.memo(
  React.forwardRef<HTMLDivElement, KanbanDataStatusProps>(
    function KanbanDataStatus({ state, onRetry, className, ...props }, ref) {
      if (state.status === "ready" && !state.isRefetching) return null
      if (state.status === "error") {
        return (
          <div
            ref={ref}
            role="alert"
            className={cn(
              "flex min-h-10 items-center gap-2 border-b border-destructive/25 bg-destructive/[0.04] px-4 py-2 text-xs text-destructive",
              className
            )}
            {...props}
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              Kanban data could not be refreshed.
            </span>
            {onRetry ? (
              <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
                <RefreshCw aria-hidden="true" /> Retry
              </Button>
            ) : null}
          </div>
        )
      }
      return (
        <div
          ref={ref}
          role="status"
          className={cn(
            "flex min-h-9 items-center gap-2 border-b bg-muted/25 px-4 py-1.5 text-[11px] text-muted-foreground",
            className
          )}
          {...props}
        >
          {state.isRefetching ? (
            <LoaderCircle
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          <span>
            {state.status === "partial"
              ? (state.message ?? "More cards are available.")
              : "Refreshing Kanban data…"}
          </span>
        </div>
      )
    }
  )
)
