import React from "react"
import { Skeleton } from "../../ui/skeleton.js"
import { cn } from "../../../lib/utils.js"

export const KanbanLoading = React.memo(React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function KanbanLoading(
  { className, ...props }, ref
) {
  return <div ref={ref} role="status" aria-label="Loading Kanban board" className={cn("flex min-h-96 gap-3 overflow-hidden p-4", className)} {...props}>
    {[0, 1, 2].map((column) => <div key={column} className="w-72 shrink-0 rounded-lg border bg-muted/20 p-3">
      <Skeleton className="mb-4 h-5 w-32" />
      {[0, 1, 2].map((card) => <Skeleton key={card} className="mb-2 h-20 w-full rounded-lg" />)}
    </div>)}
    <span className="sr-only">Loading Kanban board</span>
  </div>
}))
