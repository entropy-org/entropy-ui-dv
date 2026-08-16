import React from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "../../ui/button.js"
import type { KanbanSwimlane, KanbanSwimlaneRenderState } from "../types.js"
import { cn } from "../../../lib/utils.js"

interface Props extends Omit<React.ComponentProps<"div">, "children"> {
  readonly lane: KanbanSwimlane
  readonly state: KanbanSwimlaneRenderState
  readonly label: string
  readonly render?: (lane: KanbanSwimlane, state: KanbanSwimlaneRenderState) => React.ReactNode
  readonly onToggle: () => void
}

export const KanbanSwimlaneHeader = React.memo(React.forwardRef<HTMLDivElement, Props>(function KanbanSwimlaneHeader(
  { lane, state, label, render, onToggle, className, ...props }, ref
) {
  return <div ref={ref} className={cn("sticky left-0 flex min-h-10 items-center gap-2 border-y bg-muted/35 px-3 py-1.5 text-xs font-medium", className)} {...props}>
    <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label={`${state.collapsed ? "Expand" : "Collapse"} ${label}`} aria-expanded={!state.collapsed}>
      {state.collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
    </Button>
    <div className="min-w-0 flex-1 truncate">{render ? render(lane, state) : label}</div>
    <span className="tabular-nums text-muted-foreground">{state.cardCount}</span>
  </div>
}))
