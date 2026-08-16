import React, { useCallback, useMemo, type RefObject } from "react"
import { useCalendarConfig } from "../context/calendar-config-context.js"
import { useCalendarCommandActions } from "../hooks/use-calendar-command-actions.js"
import type { CalendarPointerInteractions } from "../hooks/use-calendar-pointer-interactions.js"
import { useCalendarStore } from "../hooks/use-calendar-store.js"
import {
  selectActions,
  selectIsHovered,
  selectIsSelected,
} from "../store/selectors.js"
import type {
  CalendarDate,
  CalendarItem,
  CalendarItemInteractionState,
  CalendarItemRenderState,
  CalendarState,
} from "../types.js"
import { addCalendarDays } from "../utils/date-engine.js"
import { getCalendarItemRange } from "../utils/date-range.js"
import { resizeCalendarRangeToDate } from "../utils/mutations.js"
import { CalendarEvent } from "./calendar-event.js"
import { canMutateCalendarItem } from "../utils/data-integration.js"

export interface CalendarEventContainerProps {
  readonly item: CalendarItem
  readonly segmentDate: CalendarDate
  readonly itemStartDate: CalendarDate
  readonly itemEndDate: CalendarDate
  readonly isRangeStart: boolean
  readonly isRangeEnd: boolean
  readonly continuedBefore: boolean
  readonly continuedAfter: boolean
  readonly timeLabel?: string | null
  readonly leftPercent: number
  readonly widthPercent: number
  readonly top: number
  readonly orderedItemIdsRef: RefObject<readonly string[]>
  readonly pointer: CalendarPointerInteractions
}

function selectItemInteraction(itemId: string) {
  return (state: CalendarState) => {
    const { interaction } = state
    if (interaction.type === "moving" && interaction.itemIds.includes(itemId)) {
      return "moving" as const
    }
    if (interaction.type === "resizing" && interaction.itemId === itemId) {
      return interaction.edge === "start"
        ? ("resizing-start" as const)
        : ("resizing-end" as const)
    }
    return "idle" as const
  }
}

/** Store-connected event segment; only the affected item rerenders. */
export const CalendarEventContainer = React.memo(
  function CalendarEventContainer({
    item,
    segmentDate,
    itemStartDate,
    itemEndDate,
    isRangeStart,
    isRangeEnd,
    continuedBefore,
    continuedAfter,
    timeLabel,
    leftPercent,
    widthPercent,
    top,
    orderedItemIdsRef,
    pointer,
  }: CalendarEventContainerProps) {
    const config = useCalendarConfig()
    const commands = useCalendarCommandActions()
    const actions = useCalendarStore(selectActions)
    const selectedSelector = useMemo(() => selectIsSelected(item.id), [item.id])
    const hoveredSelector = useMemo(() => selectIsHovered(item.id), [item.id])
    const interactionSelector = useMemo(
      () => selectItemInteraction(item.id),
      [item.id]
    )
    const selectedInStore = useCalendarStore(selectedSelector)
    const selectionEnabled = config.selection?.mode !== "none"
    const isSelected = selectionEnabled && selectedInStore
    const isHovered = useCalendarStore(hoveredSelector)
    const interactionKey = useCalendarStore(interactionSelector)
    const interaction: CalendarItemInteractionState = useMemo(
      () =>
        interactionKey === "moving"
          ? { type: "moving" }
          : interactionKey === "resizing-start"
            ? { type: "resizing", edge: "start" }
            : interactionKey === "resizing-end"
              ? { type: "resizing", edge: "end" }
              : { type: "idle" },
      [interactionKey]
    )
    const renderState: CalendarItemRenderState = useMemo(
      () => ({ isSelected, isHovered, interaction }),
      [interaction, isHovered, isSelected]
    )
    const content = useMemo(
      () => config.renderItem(item, renderState),
      [config, item, renderState]
    )
    const tooltip = useMemo(() => config.renderTooltip?.(item), [config, item])
    const ariaLabel =
      config.getItemAriaLabel?.(item).trim() ||
      config.getSearchText?.(item).trim() ||
      item.id
    const readOnly = !canMutateCalendarItem(config, item, "update")

    const selectItem = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (selectionEnabled) {
          if (event.shiftKey) {
            actions.selectRange(item.id, orderedItemIdsRef.current ?? [])
            actions.announce("Calendar selection range updated.")
          } else if (event.metaKey || event.ctrlKey) {
            actions.toggleSelection(item.id)
            actions.announce(`Calendar selection toggled for ${ariaLabel}.`)
          } else {
            actions.replaceSelection([item.id], item.id)
            actions.announce(`Selected ${ariaLabel}.`)
          }
        }
        config.onItemClick?.(item)
      },
      [actions, ariaLabel, config, item, orderedItemIdsRef, selectionEnabled]
    )

    const resizeWithKeyboard = useCallback(
      (edge: "start" | "end", days: number) => {
        if (readOnly) return
        const previousRange = getCalendarItemRange(item)
        const boundaryDate = edge === "start" ? itemStartDate : itemEndDate
        commands.commit({
          type: "resize",
          clientMutationId: commands.nextMutationId("keyboard-handle-resize"),
          itemId: item.id,
          edge,
          previousRange,
          nextRange: resizeCalendarRangeToDate(
            previousRange,
            edge,
            addCalendarDays(boundaryDate, days),
            config.preferences.timeZone
          ),
        })
      },
      [
        commands,
        config.preferences.timeZone,
        readOnly,
        item,
        itemEndDate,
        itemStartDate,
      ]
    )

    return (
      <CalendarEvent
        item={item}
        date={segmentDate}
        renderState={renderState}
        content={content}
        tooltip={tooltip}
        ariaLabel={timeLabel ? `${ariaLabel}, ${timeLabel}` : ariaLabel}
        timeLabel={timeLabel}
        isRangeStart={isRangeStart}
        isRangeEnd={isRangeEnd}
        continuedBefore={continuedBefore}
        continuedAfter={continuedAfter}
        readOnly={readOnly}
        density={config.preferences.density}
        selected={isSelected}
        interaction={interaction.type}
        style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, top }}
        onMouseEnter={() => actions.setHoveredItem(item.id)}
        onMouseLeave={() => actions.setHoveredItem(null)}
        onItemClick={selectItem}
        onItemDoubleClick={() => config.onItemDoubleClick?.(item)}
        onItemPointerDown={(event) =>
          pointer.beginItem(event, item, segmentDate)
        }
        onResizePointerDown={(event, edge) =>
          pointer.beginResize(event, item, edge, segmentDate)
        }
        onResizeKeyDown={resizeWithKeyboard}
      />
    )
  }
)
