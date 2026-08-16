import React from "react"
import { Columns3, SearchX } from "lucide-react"
import { Button } from "../../ui/button.js"
import { cn } from "../../../lib/utils.js"

type Props = React.ComponentProps<"div"> &
  ({ readonly type: "board"; readonly onClear?: never } | { readonly type: "search"; readonly onClear: () => void })

export const KanbanEmptyState = React.memo(React.forwardRef<HTMLDivElement, Props>(function KanbanEmptyState(
  { type, onClear, className, ...props }, ref
) {
  return (
    <div ref={ref} className={cn("flex min-h-72 flex-1 items-center justify-center p-8 text-center", className)} {...props}>
      <div className="max-w-sm">
        {type === "board" ? <Columns3 className="mx-auto size-8 text-muted-foreground" aria-hidden="true" /> : <SearchX className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />}
        <h2 className="mt-3 text-sm font-semibold">{type === "board" ? "No cards yet" : "No matching cards"}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{type === "board" ? "Add a card to a column to get started." : "Try another search or clear the current query."}</p>
        {type === "search" ? <Button className="mt-4" size="sm" variant="outline" onClick={onClear}>Clear search</Button> : null}
      </div>
    </div>
  )
}))
