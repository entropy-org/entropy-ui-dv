import React, { useMemo, useRef } from "react"
import { useCalendarConfig } from "../context/calendar-config-context.js"
import type { CalendarPointerInteractions } from "../hooks/use-calendar-pointer-interactions.js"
import { useCalendarStore } from "../hooks/use-calendar-store.js"
import {
  selectActions,
  selectInteraction,
  selectOverflow,
} from "../store/selectors.js"
import type { CalendarItem } from "../types.js"
import {
  formatTimedItemStart,
  type CalendarRenderModel,
} from "../utils/calendar-model.js"
import { formatCalendarDateLabel } from "../utils/date-engine.js"
import type { CalendarLanePlacement } from "../utils/date-lanes.js"
import { isDateWithinSpan } from "../utils/date-range.js"
import { getColumnSpanPosition } from "../utils/position.js"
import { CalendarDayCellContainer } from "./calendar-day-cell-container.js"
import { CalendarEventContainer } from "./calendar-event-container.js"
import { CalendarOverflowPopover } from "./calendar-overflow-popover.js"
import { cn } from "../../../lib/utils.js"

const HEADER_HEIGHT = 30

export type CalendarDateViewProps = React.ComponentProps<"div"> & {
  readonly mode: "month" | "week"
  readonly model: CalendarRenderModel & {
    readonly today: string
    readonly title: string
  }
  readonly pointer: CalendarPointerInteractions
}

export const CalendarDateView = React.memo(
  React.forwardRef<HTMLDivElement, CalendarDateViewProps>(
    function CalendarDateView(
      { mode, model, pointer, className, ...props },
      ref
    ) {
      const config = useCalendarConfig()
      const actions = useCalendarStore(selectActions)
      const interaction = useCalendarStore(selectInteraction)
      const overflow = useCalendarStore(selectOverflow)
      const orderedItemIdsRef = useRef<readonly string[]>(model.orderedItemIds)
      orderedItemIdsRef.current = model.orderedItemIds
      const itemById = useMemo(
        () => new Map(model.items.map((item) => [item.id, item])),
        [model.items]
      )
      const placementsByRow = useMemo(() => {
        const rows = model.grid.rows.map(() => [] as CalendarLanePlacement[])
        for (const placement of model.lanes.visiblePlacements) {
          rows[placement.rowIndex]?.push(placement)
        }
        return rows
      }, [model.grid.rows, model.lanes.visiblePlacements])
      const overflowByDate = useMemo(
        () =>
          new Map(
            model.lanes.overflowByDate.map((entry) => [entry.date, entry])
          ),
        [model.lanes.overflowByDate]
      )
      const hiddenItemsByDate = useMemo(() => {
        const hiddenIds = new Map<string, Set<string>>()
        for (const placement of model.lanes.placements) {
          if (placement.isVisible) continue
          const row = model.grid.rows[placement.rowIndex]
          for (const cell of row?.visibleCells ?? []) {
            if (!isDateWithinSpan(cell.date, placement.segment)) continue
            const ids = hiddenIds.get(cell.date) ?? new Set<string>()
            ids.add(placement.item.item.id)
            hiddenIds.set(cell.date, ids)
          }
        }
        return new Map(
          [...hiddenIds].map(([date, ids]) => [
            date,
            [...ids].flatMap((id) => itemById.get(id) ?? []),
          ])
        )
      }, [itemById, model.grid.rows, model.lanes.placements])
      const visibleDates = useMemo(
        () =>
          model.grid.rows.flatMap((row) =>
            row.visibleCells.map(({ date }) => date)
          ),
        [model.grid.rows]
      )
      const defaultTabStop = visibleDates.includes(model.today)
        ? model.today
        : visibleDates.includes(model.grid.anchorDate)
          ? model.grid.anchorDate
          : visibleDates[0]
      const laneHeight = config.preferences.density === "compact" ? 20 : 24
      const createSpan =
        interaction.type === "creating" &&
        interaction.preview.kind === "all-day"
          ? interaction.preview
          : null

      const selectOverflowItem = (
        item: CalendarItem,
        event: Pick<React.MouseEvent, "shiftKey" | "metaKey" | "ctrlKey">
      ) => {
        if (config.selection?.mode === "none") return
        if (event.shiftKey) {
          actions.selectRange(item.id, orderedItemIdsRef.current)
          actions.announce("Calendar selection range updated.")
        } else if (event.metaKey || event.ctrlKey) {
          actions.toggleSelection(item.id)
          actions.announce(`Calendar selection toggled for ${item.id}.`)
        } else {
          actions.replaceSelection([item.id], item.id)
          actions.announce(`Selected ${item.id}.`)
        }
      }

      return (
        <div
          ref={ref}
          role="grid"
          aria-label={`${model.title} ${mode} view`}
          aria-colcount={model.grid.rows[0]?.visibleCells.length ?? 0}
          aria-rowcount={model.grid.rows.length}
          aria-multiselectable={config.selection?.mode !== "none"}
          aria-readonly={config.readOnly ?? false}
          aria-busy={interaction.type !== "idle"}
          className={cn(
            "grid min-h-0 flex-1 overflow-auto bg-border motion-reduce:scroll-auto",
            mode === "week" ? "grid-rows-1" : "auto-rows-fr",
            className
          )}
          style={{
            gridTemplateRows:
              mode === "week"
                ? "minmax(360px, 1fr)"
                : model.grid.rows
                    .map((_, rowIndex) => {
                      const lanes = Math.min(
                        model.lanes.laneCountByRow[rowIndex] ?? 0,
                        model.maxVisibleLanes
                      )
                      const minimum = Math.max(
                        104,
                        HEADER_HEIGHT + lanes * laneHeight + 24
                      )
                      return `minmax(${minimum}px, 1fr)`
                    })
                    .join(" "),
          }}
          data-calendar-grid
          data-testid={`calendar-${mode}-view`}
          onPointerMove={pointer.onPointerMove}
          onPointerUp={pointer.onPointerUp}
          onPointerCancel={pointer.onPointerCancel}
          {...props}
        >
          {model.grid.rows.map((row) => (
            <div
              key={row.startDate}
              role="row"
              aria-rowindex={row.rowIndex + 1}
              className="relative min-h-0 bg-background"
              data-calendar-row={row.rowIndex}
            >
              <div
                role="presentation"
                className="absolute inset-0 grid"
                style={{
                  gridTemplateColumns: `repeat(${row.visibleCells.length}, minmax(0, 1fr))`,
                }}
              >
                {row.visibleCells.map((cell) => (
                  <CalendarDayCellContainer
                    key={cell.date}
                    cell={cell}
                    dateLabel={
                      cell.dayOfMonth === 1
                        ? formatCalendarDateLabel(cell.date, config.locale, {
                            month: "short",
                            day: "numeric",
                          })
                        : undefined
                    }
                    currentMonth={mode === "week" || cell.isCurrentMonth}
                    today={cell.date === model.today}
                    creating={
                      createSpan
                        ? isDateWithinSpan(cell.date, createSpan)
                        : false
                    }
                    showWeekday={mode === "week"}
                    defaultTabStop={defaultTabStop === cell.date}
                    pointer={pointer}
                  />
                ))}
              </div>
              {(placementsByRow[row.rowIndex] ?? []).map((placement) => {
                const item = placement.item.item
                const position = getColumnSpanPosition(
                  placement.startColumn,
                  placement.endColumn,
                  row.visibleCells.length
                )
                if (!position) return null
                return (
                  <CalendarEventContainer
                    key={`${item.id}-${placement.rowIndex}`}
                    item={item}
                    segmentDate={placement.segment.startDate}
                    itemStartDate={placement.item.dateSpan.startDate}
                    itemEndDate={placement.item.dateSpan.endDate}
                    timeLabel={formatTimedItemStart(
                      item,
                      config.locale,
                      config.preferences
                    )}
                    isRangeStart={placement.isRangeStart}
                    isRangeEnd={placement.isRangeEnd}
                    continuedBefore={placement.continuedBefore}
                    continuedAfter={placement.continuedAfter}
                    leftPercent={position.leftPercent}
                    widthPercent={position.widthPercent}
                    top={HEADER_HEIGHT + placement.lane * laneHeight}
                    orderedItemIdsRef={orderedItemIdsRef}
                    pointer={pointer}
                  />
                )
              })}
              {row.visibleCells.map((cell) => {
                if (!overflowByDate.has(cell.date)) return null
                const hiddenItems = hiddenItemsByDate.get(cell.date) ?? []
                const left =
                  ((cell.visibleColumnIndex ?? 0) / row.visibleCells.length) *
                  100
                const width = 100 / row.visibleCells.length
                const triggerId = `calendar-overflow-${cell.date}`
                return (
                  <CalendarOverflowPopover
                    key={cell.date}
                    date={cell.date}
                    label={formatCalendarDateLabel(cell.date, config.locale, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                    hiddenItems={hiddenItems}
                    open={
                      overflow.type === "open" && overflow.date === cell.date
                    }
                    renderItem={config.renderOverflowItem ?? config.renderItem}
                    onOpenChange={(open) => {
                      if (open) {
                        actions.openOverflow(cell.date, triggerId)
                        actions.announce(
                          `${hiddenItems.length} overflow calendar items opened for ${cell.date}.`
                        )
                      } else {
                        actions.closeOverflow()
                        actions.announce("Overflow calendar items closed.")
                      }
                    }}
                    onItemClick={(item, event) => {
                      selectOverflowItem(item, event)
                      config.onItemClick?.(item)
                      actions.closeOverflow()
                    }}
                    className="absolute px-1"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      top: HEADER_HEIGHT + model.maxVisibleLanes * laneHeight,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      )
    }
  )
)
