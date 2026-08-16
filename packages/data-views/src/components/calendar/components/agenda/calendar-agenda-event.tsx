import React, { useCallback, useMemo } from "react"
import { useCalendarConfig } from "../../context/calendar-config-context.js"
import type { CalendarAgendaInteractions } from "../../hooks/use-calendar-agenda-interactions.js"
import { useCalendarCommandActions } from "../../hooks/use-calendar-command-actions.js"
import { useCalendarStore } from "../../hooks/use-calendar-store.js"
import {
  selectActions,
  selectIsHovered,
  selectIsSelected,
} from "../../store/selectors.js"
import type {
  CalendarAgendaRenderState,
  CalendarDate,
  CalendarItem,
  CalendarItemInteractionState,
  CalendarState,
} from "../../types.js"
import { agendaWallClockToInstant } from "../../utils/agenda.js"
import { getCalendarItemRange } from "../../utils/date-range.js"
import { cn } from "../../../../lib/utils.js"
import { canMutateCalendarItem } from "../../utils/data-integration.js"

function selectInteraction(itemId: string) {
  return (state: CalendarState) => {
    if (
      state.interaction.type === "moving" &&
      state.interaction.itemIds.includes(itemId)
    )
      return "moving" as const
    if (
      state.interaction.type === "resizing" &&
      state.interaction.itemId === itemId
    )
      return state.interaction.edge
    return "idle" as const
  }
}

export type CalendarAgendaEventProps = React.ComponentProps<"div"> & {
  readonly item: CalendarItem
  readonly segmentDate: CalendarDate
  readonly continuedBefore: boolean
  readonly continuedAfter: boolean
  readonly allDay?: boolean
  readonly interactions: CalendarAgendaInteractions
  readonly orderedItemIds: readonly string[]
}

export const CalendarAgendaEvent = React.memo(
  React.forwardRef<HTMLDivElement, CalendarAgendaEventProps>(
    function CalendarAgendaEvent(
      {
        item,
        segmentDate,
        continuedBefore,
        continuedAfter,
        allDay = false,
        interactions,
        orderedItemIds,
        className,
        style,
        ...props
      },
      ref
    ) {
      const config = useCalendarConfig()
      const commands = useCalendarCommandActions()
      const actions = useCalendarStore(selectActions)
      const selectedInStore = useCalendarStore(
        useMemo(() => selectIsSelected(item.id), [item.id])
      )
      const selectionEnabled = config.selection?.mode !== "none"
      const selected = selectionEnabled && selectedInStore
      const hovered = useCalendarStore(
        useMemo(() => selectIsHovered(item.id), [item.id])
      )
      const interactionKey = useCalendarStore(
        useMemo(() => selectInteraction(item.id), [item.id])
      )
      const interaction: CalendarItemInteractionState =
        interactionKey === "moving"
          ? { type: "moving" }
          : interactionKey === "start" || interactionKey === "end"
            ? { type: "resizing", edge: interactionKey }
            : { type: "idle" }
      const renderState: CalendarAgendaRenderState = {
        isSelected: selected,
        isHovered: hovered,
        interaction,
        segmentDate,
        continuedBefore,
        continuedAfter,
      }
      const content =
        item.kind === "timed"
          ? (config.agenda?.renderTimedItem?.(item, renderState) ??
            config.renderItem(item, renderState))
          : (config.agenda?.renderAllDayItem?.(item, renderState) ??
            config.renderItem(item, renderState))
      const label =
        config.getItemAriaLabel?.(item).trim() ||
        config.getSearchText?.(item).trim() ||
        item.id
      const readOnly = !canMutateCalendarItem(config, item, "update")

      const select = useCallback(
        (event: React.MouseEvent) => {
          event.stopPropagation()
          if (selectionEnabled) {
            if (event.shiftKey) actions.selectRange(item.id, orderedItemIds)
            else if (event.ctrlKey || event.metaKey)
              actions.toggleSelection(item.id)
            else actions.replaceSelection([item.id], item.id)
            actions.announce(`Selected ${label}.`)
          }
          config.onItemClick?.(item)
        },
        [actions, config, item, label, orderedItemIds, selectionEnabled]
      )

      const resizeWithKeyboard = useCallback(
        (edge: "start" | "end", direction: -1 | 1) => {
          if (readOnly || item.kind !== "timed") return
          const previousRange = getCalendarItemRange(item)
          if (previousRange.kind !== "timed") return
          const delta = config.preferences.agenda.snapMinutes * direction
          const boundary =
            edge === "start" ? previousRange.start : previousRange.end
          const minutes = new Intl.DateTimeFormat("en-US", {
            timeZone: config.preferences.timeZone,
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          }).formatToParts(boundary)
          const values = new Map(minutes.map((part) => [part.type, part.value]))
          const next = agendaWallClockToInstant(
            segmentDate,
            Number(values.get("hour")) * 60 +
              Number(values.get("minute")) +
              delta,
            config.preferences.timeZone
          )
          const minimum =
            (config.agenda?.minimumTimedDurationMinutes ??
              config.preferences.agenda.snapMinutes) * 60_000
          commands.commit({
            type: "resize",
            clientMutationId: commands.nextMutationId("agenda-keyboard-resize"),
            itemId: item.id,
            edge,
            previousRange,
            nextRange: {
              kind: "timed",
              start:
                edge === "start"
                  ? new Date(
                      Math.min(
                        next.getTime(),
                        previousRange.end.getTime() - minimum
                      )
                    )
                  : previousRange.start,
              end:
                edge === "end"
                  ? new Date(
                      Math.max(
                        next.getTime(),
                        previousRange.start.getTime() + minimum
                      )
                    )
                  : previousRange.end,
            },
          })
        },
        [commands, config, item, readOnly, segmentDate]
      )

      return (
        <div
          ref={ref}
          className={cn(
            "group/agenda-event absolute z-10 min-h-5 min-w-0 touch-none overflow-hidden rounded-md border border-primary/30 bg-primary/15 text-primary shadow-xs outline-none",
            "focus-within:ring-2 focus-within:ring-ring/60 hover:bg-primary/20 forced-colors:border-[ButtonText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]",
            selected &&
              "z-30 border-primary bg-primary/25 ring-1 ring-primary/50",
            interaction.type !== "idle" && "z-40 opacity-80 shadow-md",
            className
          )}
          style={style}
          data-calendar-agenda-event={item.id}
          data-calendar-date={segmentDate}
          {...props}
        >
          <button
            type="button"
            className="flex size-full min-w-0 cursor-pointer items-start gap-1 overflow-hidden px-1.5 py-1 text-left text-[11px] leading-tight font-medium outline-none select-none"
            aria-label={`${label}${continuedBefore ? ", continues from previous day" : ""}${continuedAfter ? ", continues to next day" : ""}`}
            aria-pressed={selected}
            onClick={select}
            onDoubleClick={() => config.onItemDoubleClick?.(item)}
            onPointerDown={(event) =>
              interactions.beginMove(event, item, allDay)
            }
          >
            {continuedBefore ? <span aria-hidden="true">‹</span> : null}
            <span className="min-w-0 flex-1 truncate">{content}</span>
            {continuedAfter ? <span aria-hidden="true">›</span> : null}
          </button>
          {!readOnly ? (
            <>
              <button
                type="button"
                className={cn(
                  "absolute z-20 opacity-0 group-hover/agenda-event:opacity-100 focus:opacity-100",
                  allDay
                    ? "inset-y-0 left-0 w-2 cursor-ew-resize"
                    : "inset-x-0 top-0 h-2 cursor-ns-resize"
                )}
                aria-label={`Resize ${label} start`}
                onPointerDown={(event) =>
                  interactions.beginResize(event, item, "start", allDay)
                }
                onKeyDown={(event) => {
                  if (
                    allDay ||
                    (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                  )
                    return
                  event.preventDefault()
                  resizeWithKeyboard("start", event.key === "ArrowUp" ? -1 : 1)
                }}
              />
              <button
                type="button"
                className={cn(
                  "absolute z-20 opacity-0 group-hover/agenda-event:opacity-100 focus:opacity-100",
                  allDay
                    ? "inset-y-0 right-0 w-2 cursor-ew-resize"
                    : "inset-x-0 bottom-0 h-2 cursor-ns-resize"
                )}
                aria-label={`Resize ${label} end`}
                onPointerDown={(event) =>
                  interactions.beginResize(event, item, "end", allDay)
                }
                onKeyDown={(event) => {
                  if (
                    allDay ||
                    (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                  )
                    return
                  event.preventDefault()
                  resizeWithKeyboard("end", event.key === "ArrowUp" ? -1 : 1)
                }}
              />
            </>
          ) : null}
        </div>
      )
    }
  )
)
