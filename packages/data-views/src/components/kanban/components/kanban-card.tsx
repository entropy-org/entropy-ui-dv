import React, { useMemo } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cva } from "class-variance-authority"
import type {
  KanbanCard as KanbanCardModel,
  KanbanCardRenderState,
} from "../types.js"
import { cn } from "../../../lib/utils.js"

const cardVariants = cva(
  "group relative w-full cursor-pointer touch-none rounded-lg border bg-card text-card-foreground shadow-xs transition-[border-color,box-shadow,opacity] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 motion-reduce:transition-none forced-colors:border-[CanvasText]",
  {
    variants: {
      density: { compact: "p-2 text-xs", comfortable: "p-3 text-sm" },
      selected: {
        true: "border-primary/60 bg-primary/[0.045] ring-1 ring-primary/25",
        false: "hover:border-foreground/20 hover:shadow-sm",
      },
      dragging: { true: "opacity-35", false: "opacity-100" },
      pending: { true: "border-dashed", false: "" },
    },
    defaultVariants: {
      density: "comfortable",
      selected: false,
      dragging: false,
      pending: false,
    },
  }
)

export interface KanbanCardSurfaceProps extends Omit<
  React.ComponentProps<"div">,
  "children" | "onClick" | "role" | "tabIndex"
> {
  readonly card: KanbanCardModel
  readonly index: number
  readonly setSize: number
  readonly renderState: KanbanCardRenderState
  readonly density: "compact" | "comfortable"
  readonly label: string
  readonly disabled: boolean
  readonly onActivate: (event: React.MouseEvent<HTMLElement>) => void
  readonly onOpen: () => void
  readonly render: (
    card: KanbanCardModel,
    state: KanbanCardRenderState
  ) => React.ReactNode
}

function isRendererInteraction(
  target: EventTarget | null,
  current: HTMLElement
) {
  return (
    target instanceof Element &&
    target !== current &&
    Boolean(
      target.closest(
        "a,button,input,textarea,select,[contenteditable='true'],[data-kanban-interactive]"
      )
    )
  )
}

export const KanbanCardSurface = React.memo(
  React.forwardRef<HTMLDivElement, KanbanCardSurfaceProps>(
    function KanbanCardSurface(
      {
        card,
        index,
        setSize,
        renderState,
        density,
        label,
        disabled,
        onActivate,
        onOpen,
        render,
        className,
        style,
        onDoubleClick,
        ...props
      },
      forwardedRef
    ) {
      const sortable = useSortable({
        id: `card:${card.id}`,
        disabled,
        data: {
          type: "card",
          cardId: card.id,
          groupId: card.groupId,
          swimlaneId: card.swimlaneId,
          index,
        },
      })
      const mergedState = useMemo(
        () => ({
          ...renderState,
          dragging: renderState.dragging || sortable.isDragging,
        }),
        [renderState, sortable.isDragging]
      )
      const setRefs = (element: HTMLDivElement | null) => {
        sortable.setNodeRef(element)
        if (typeof forwardedRef === "function") forwardedRef(element)
        else if (forwardedRef) forwardedRef.current = element
      }
      return (
        <div
          ref={setRefs}
          {...sortable.attributes}
          {...(disabled ? {} : sortable.listeners)}
          {...props}
          role="group"
          aria-label={label}
          tabIndex={renderState.focused ? 0 : -1}
          data-kanban-card={card.id}
          data-card-position={`${index + 1}:${setSize}`}
          data-selected={renderState.selected || undefined}
          className={cn(
            cardVariants({
              density,
              selected: renderState.selected,
              dragging: mergedState.dragging,
              pending: renderState.pending,
            }),
            className
          )}
          style={{
            ...style,
            transform: CSS.Transform.toString(sortable.transform),
            transition: sortable.transition,
          }}
          onClick={(event) => {
            if (!isRendererInteraction(event.target, event.currentTarget))
              onActivate(event)
          }}
          onDoubleClick={(event) => {
            onDoubleClick?.(event)
            if (
              !event.defaultPrevented &&
              !isRendererInteraction(event.target, event.currentTarget)
            )
              onOpen()
          }}
        >
          {render(card, mergedState)}
          <span className="sr-only">Card {index + 1} of {setSize}</span>
          {renderState.selected ? <span className="sr-only">Selected</span> : null}
          {renderState.wipWarning ? (
            <span className="sr-only">WIP limit exceeded</span>
          ) : null}
        </div>
      )
    }
  )
)
