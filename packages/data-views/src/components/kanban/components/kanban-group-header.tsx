import React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDown, ChevronRight, GripVertical, Plus } from "lucide-react"
import { Button } from "../../ui/button.js"
import type { KanbanGroup, KanbanGroupRenderState } from "../types.js"
import { cn } from "../../../lib/utils.js"

interface Props extends Omit<React.ComponentProps<"div">, "children"> {
  readonly group: KanbanGroup
  readonly index: number
  readonly state: KanbanGroupRenderState
  readonly label: string
  readonly render?: (group: KanbanGroup, state: KanbanGroupRenderState) => React.ReactNode
  readonly onToggle: () => void
  readonly onAdd?: () => void
  readonly showWipLimits: boolean
}

export const KanbanGroupHeader = React.memo(React.forwardRef<HTMLDivElement, Props>(function KanbanGroupHeader(
  { group, index, state, label, render, onToggle, onAdd, showWipLimits, className, style, ...props }, forwardedRef
) {
  const sortable = useSortable({ id: `group:${group.id}`, disabled: state.readOnly, data: { type: "group", groupId: group.id, index } })
  const setRefs = (element: HTMLDivElement | null) => {
    sortable.setNodeRef(element)
    if (typeof forwardedRef === "function") forwardedRef(element)
    else if (forwardedRef) forwardedRef.current = element
  }
  const wip = state.wip
  const wipExceeded = wip.status === "warning" || wip.status === "hard-blocked"
  return (
    <div ref={setRefs} className={cn("flex min-h-12 items-center gap-1 border-b bg-muted/20 px-2.5 py-2", className)} style={{ ...style, transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} data-kanban-group={group.id} {...props}>
      {!state.readOnly ? <button type="button" className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing" aria-label={`Reorder ${label}`} {...sortable.attributes} {...sortable.listeners}><GripVertical className="size-3.5" aria-hidden="true" /></button> : null}
      <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-expanded={!state.collapsed} aria-label={`${state.collapsed ? "Expand" : "Collapse"} ${label}`}>
        {state.collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </Button>
      <div className="min-w-0 flex-1 truncate text-xs font-semibold">{render ? render(group, state) : label}</div>
      <span className={cn("rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground", showWipLimits && wipExceeded && "bg-amber-500/15 text-amber-800 dark:text-amber-300 forced-colors:border")}>{state.cardCount}{showWipLimits && wip.maximum !== null ? `/${wip.maximum}` : ""}</span>
      {onAdd ? <Button variant="ghost" size="icon-sm" onClick={onAdd} aria-label={`Add card to ${label}`}><Plus aria-hidden="true" /></Button> : null}
    </div>
  )
}))
