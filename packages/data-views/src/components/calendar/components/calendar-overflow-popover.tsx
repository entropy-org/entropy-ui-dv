import React from "react"
import type {
  CalendarDate,
  CalendarItem,
  CalendarItemRenderState,
} from "../types.js"
import { Button } from "../../ui/button.js"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "../../ui/popover.js"
import { cn } from "../../../lib/utils.js"

export type CalendarOverflowPopoverProps = React.ComponentProps<"div"> & {
  readonly date: CalendarDate
  readonly label: string
  readonly hiddenItems: readonly CalendarItem[]
  readonly open: boolean
  readonly renderItem: (
    item: CalendarItem,
    state: CalendarItemRenderState
  ) => React.ReactNode
  readonly onOpenChange: (open: boolean) => void
  readonly onItemClick: (
    item: CalendarItem,
    event: React.MouseEvent<HTMLButtonElement>
  ) => void
}

export const CalendarOverflowPopover = React.memo(
  React.forwardRef<HTMLDivElement, CalendarOverflowPopoverProps>(
    function CalendarOverflowPopover(
      {
        date,
        label,
        hiddenItems,
        open,
        renderItem,
        onOpenChange,
        onItemClick,
        className,
        ...props
      },
      ref
    ) {
      return (
        <div
          ref={ref}
          role="gridcell"
          className={cn("relative z-20", className)}
          {...props}
        >
          <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-5 w-full justify-start px-1 text-[10px] text-muted-foreground motion-reduce:transition-none forced-colors:border forced-colors:border-[ButtonText]"
                  data-calendar-overflow={date}
                  aria-label={`${hiddenItems.length} more events on ${label}`}
                >
                  +{hiddenItems.length} more
                </Button>
              }
            />
            <PopoverContent align="start" className="w-72 gap-2 p-3">
              <PopoverHeader>
                <PopoverTitle>{label}</PopoverTitle>
              </PopoverHeader>
              <div className="space-y-1">
                {hiddenItems.map((item) => {
                  const state: CalendarItemRenderState = {
                    isSelected: false,
                    isHovered: false,
                    interaction: { type: "idle" },
                  }
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="flex w-full cursor-pointer items-center rounded-md bg-primary/10 px-2 py-1.5 text-left text-xs text-primary select-none hover:bg-primary/15"
                      onClick={(event) => onItemClick(item, event)}
                    >
                      {renderItem(item, state)}
                    </button>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )
    }
  )
)
