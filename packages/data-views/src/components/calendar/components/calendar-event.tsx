import React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import type {
  CalendarDate,
  CalendarItem,
  CalendarItemRenderState,
} from "../types.js"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../ui/tooltip.js"
import { cn } from "../../../lib/utils.js"

const calendarEventVariants = cva(
  "group/event absolute z-10 min-w-0 touch-none px-0.5 outline-none select-none",
  {
    variants: {
      density: {
        compact: "h-5",
        comfortable: "h-6",
      },
      selected: {
        true: "z-20",
        false: "",
      },
      interaction: {
        idle: "",
        moving: "z-30 opacity-80 drop-shadow-md",
        resizing: "z-30 opacity-90 drop-shadow-md",
      },
    },
    defaultVariants: {
      density: "comfortable",
      selected: false,
      interaction: "idle",
    },
  }
)

export type CalendarEventProps = Omit<
  React.ComponentProps<"div">,
  "children" | "content"
> &
  VariantProps<typeof calendarEventVariants> & {
    readonly date: CalendarDate
    readonly item: CalendarItem
    readonly renderState: CalendarItemRenderState
    readonly content: React.ReactNode
    readonly ariaLabel: string
    readonly tooltip?: React.ReactNode
    readonly timeLabel?: string | null
    readonly isRangeStart: boolean
    readonly isRangeEnd: boolean
    readonly continuedBefore: boolean
    readonly continuedAfter: boolean
    readonly readOnly: boolean
    readonly onItemClick: (event: React.MouseEvent<HTMLButtonElement>) => void
    readonly onItemDoubleClick: (
      event: React.MouseEvent<HTMLButtonElement>
    ) => void
    readonly onItemPointerDown: (event: React.PointerEvent<HTMLElement>) => void
    readonly onResizePointerDown: (
      event: React.PointerEvent<HTMLElement>,
      edge: "start" | "end"
    ) => void
    readonly onResizeKeyDown: (edge: "start" | "end", days: -1 | 1) => void
  }

export const CalendarEvent = React.memo(
  React.forwardRef<HTMLDivElement, CalendarEventProps>(function CalendarEvent(
    {
      item,
      date,
      renderState,
      content,
      ariaLabel,
      tooltip,
      timeLabel,
      isRangeStart,
      isRangeEnd,
      continuedBefore,
      continuedAfter,
      readOnly,
      density,
      selected,
      interaction,
      onItemClick,
      onItemDoubleClick,
      onItemPointerDown,
      onResizePointerDown,
      onResizeKeyDown,
      className,
      ...props
    },
    ref
  ) {
    const button = (
      <button
        type="button"
        className={cn(
          "flex size-full min-w-0 cursor-pointer items-center gap-1 overflow-hidden border bg-primary/10 px-1.5 text-left text-[11px] font-medium text-primary outline-none select-none hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring/50",
          "motion-reduce:transition-none forced-colors:border-[ButtonText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]",
          !isRangeStart && "rounded-l-none border-l-0",
          !isRangeEnd && "rounded-r-none border-r-0",
          isRangeStart && "rounded-l-md",
          isRangeEnd && "rounded-r-md",
          selected && "border-primary bg-primary/20 ring-1 ring-primary/40"
        )}
        data-calendar-event={item.id}
        data-continued-before={continuedBefore || undefined}
        data-continued-after={continuedAfter || undefined}
        aria-pressed={selected ?? false}
        aria-label={ariaLabel}
        onClick={onItemClick}
        onDoubleClick={onItemDoubleClick}
        onPointerDown={onItemPointerDown}
      >
        {continuedBefore ? <span aria-hidden="true">‹</span> : null}
        {timeLabel ? (
          <span className="shrink-0 text-[9px]">{timeLabel}</span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{content}</span>
        {continuedAfter ? <span aria-hidden="true">›</span> : null}
      </button>
    )

    return (
      <div
        ref={ref}
        className={cn(
          calendarEventVariants({ density, selected, interaction }),
          className
        )}
        data-testid={`calendar-event-${item.id}`}
        data-calendar-event-segment-date={date}
        data-hovered={renderState.isHovered || undefined}
        role="gridcell"
        {...props}
      >
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger render={button} />
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        ) : (
          button
        )}
        {!readOnly && isRangeStart ? (
          <button
            type="button"
            className="absolute inset-y-0 left-0 z-20 w-2 cursor-ew-resize opacity-0 group-hover/event:opacity-100 focus:opacity-100"
            aria-label={`Resize ${item.id} start`}
            onPointerDown={(event) => onResizePointerDown(event, "start")}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                return
              event.preventDefault()
              event.stopPropagation()
              onResizeKeyDown("start", event.key === "ArrowLeft" ? -1 : 1)
            }}
          />
        ) : null}
        {!readOnly && isRangeEnd ? (
          <button
            type="button"
            className="absolute inset-y-0 right-0 z-20 w-2 cursor-ew-resize opacity-0 group-hover/event:opacity-100 focus:opacity-100"
            aria-label={`Resize ${item.id} end`}
            onPointerDown={(event) => onResizePointerDown(event, "end")}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                return
              event.preventDefault()
              event.stopPropagation()
              onResizeKeyDown("end", event.key === "ArrowLeft" ? -1 : 1)
            }}
          />
        ) : null}
      </div>
    )
  })
)
