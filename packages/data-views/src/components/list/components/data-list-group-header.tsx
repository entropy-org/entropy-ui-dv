import React from "react"
import { ChevronRight, Plus } from "lucide-react"
import { Button } from "../../ui/button.js"
import type { DataListResolvedGroup } from "../types.js"
import { cn } from "../../../lib/utils.js"

export interface DataListGroupHeaderProps<TData> extends Omit<
  React.ComponentPropsWithoutRef<"div">,
  "children" | "onToggle"
> {
  readonly group: DataListResolvedGroup<TData>
  readonly collapsed: boolean
  readonly collapsible: boolean
  readonly customContent?: React.ReactNode
  readonly onToggle: (key: string) => void
  readonly onAdd?: (key: string) => void
  readonly gridSemantics?: boolean
}

function DataListGroupHeaderInner<TData>(
  {
    group,
    collapsed,
    collapsible,
    customContent,
    onToggle,
    onAdd,
    gridSemantics = false,
    className,
    ...props
  }: DataListGroupHeaderProps<TData>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <div
      ref={ref}
      role={gridSemantics ? "row" : undefined}
      className={cn(
        "group/group h-9 border-y border-border/50 bg-muted/30 text-xs text-muted-foreground backdrop-blur-sm forced-colors:border-[CanvasText]",
        className
      )}
      data-list-part="group-header"
      data-list-group-key={group.key}
      {...props}
    >
      <div
        role={gridSemantics ? "gridcell" : undefined}
        className="flex h-full w-full items-center gap-1.5 px-2"
      >
      {collapsible ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => onToggle(group.key)}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${group.textLabel}`}
          aria-expanded={!collapsed}
        >
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform motion-reduce:transition-none",
              !collapsed && "rotate-90"
            )}
          />
        </Button>
      ) : (
        <span className="w-6" />
      )}
      <div className="min-w-0 truncate font-medium text-foreground/85">
        {customContent ?? group.label}
      </div>
      <span className="tabular-nums">{group.count}</span>
      {group.aggregate ? (
        <div className="ml-auto min-w-0 truncate">{group.aggregate}</div>
      ) : (
        <span className="flex-1" />
      )}
      {onAdd && !group.disabled ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 opacity-0 group-hover/group:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none"
          onClick={() => onAdd(group.key)}
          aria-label={`Add to ${group.textLabel}`}
        >
          <Plus className="size-3.5" />
        </Button>
      ) : null}
      </div>
    </div>
  )
}

export const DataListGroupHeader = React.memo(
  React.forwardRef(DataListGroupHeaderInner)
) as <TData>(
  props: DataListGroupHeaderProps<TData> & React.RefAttributes<HTMLDivElement>
) => React.ReactElement
