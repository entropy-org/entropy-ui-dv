import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useCalendarConfig } from "../../context/calendar-config-context.js"
import { useCalendarAgendaInteractions } from "../../hooks/use-calendar-agenda-interactions.js"
import { useCalendarCommandActions } from "../../hooks/use-calendar-command-actions.js"
import { useSelectedCalendarIds } from "../../hooks/use-calendar-selectors.js"
import { useCalendarStore } from "../../hooks/use-calendar-store.js"
import {
  selectActions,
  selectAnchorDate,
  selectFocusedDate,
  selectInteraction,
} from "../../store/selectors.js"
import type { CalendarDate, CalendarItem } from "../../types.js"
import {
  agendaWallClockToInstant,
  getAgendaHourHeight,
  getAgendaVisibleSpan,
  getWallClockMinutes,
  layoutAgendaAllDaySegments,
  layoutAgendaTimedSegments,
  shiftTimedRangeByWallClock,
} from "../../utils/agenda.js"
import {
  formatCalendarDateLabel,
  getCalendarDateInTimeZone,
} from "../../utils/date-engine.js"
import { getCalendarItemRange } from "../../utils/date-range.js"
import { shiftCalendarRangeByDays } from "../../utils/mutations.js"
import { cn } from "../../../../lib/utils.js"
import { CalendarAgendaEvent } from "./calendar-agenda-event.js"

const GUTTER_WIDTH = 60
const ALL_DAY_LANE_HEIGHT = 24

export type CalendarAgendaViewProps = React.ComponentProps<"section"> & {
  readonly items: readonly CalendarItem[]
  readonly today: CalendarDate
}

function formatTime(
  minutes: number,
  locale: string | undefined,
  timeFormat: "12h" | "24h"
): string {
  const date = new Date(
    Date.UTC(2020, 0, 1, Math.floor(minutes / 60), minutes % 60)
  )
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    hour: "numeric",
    minute: minutes % 60 === 0 ? undefined : "2-digit",
    hour12: timeFormat === "12h",
  }).format(date)
}

function useCurrentTime(now: (() => Date) | undefined): Date {
  const [value, setValue] = useState(() => now?.() ?? new Date())
  useEffect(() => {
    const update = () => setValue(now?.() ?? new Date())
    update()
    const timer = setInterval(update, 60_000)
    return () => clearInterval(timer)
  }, [now])
  return value
}

export const CalendarAgendaView = React.memo(
  React.forwardRef<HTMLElement, CalendarAgendaViewProps>(
    function CalendarAgendaView({ items, today, className, ...props }, ref) {
      const config = useCalendarConfig()
      const anchorDate = useCalendarStore(selectAnchorDate)
      const focusedDate = useCalendarStore(selectFocusedDate)
      const interaction = useCalendarStore(selectInteraction)
      const actions = useCalendarStore(selectActions)
      const commands = useCalendarCommandActions()
      const selectedIds = useSelectedCalendarIds()
      const preferences = config.preferences.agenda
      const span = useMemo(
        () =>
          getAgendaVisibleSpan(
            anchorDate,
            preferences.span,
            config.preferences.weekStartsOn,
            config.preferences.showWeekends
          ),
        [
          anchorDate,
          config.preferences.showWeekends,
          config.preferences.weekStartsOn,
          preferences.span,
        ]
      )
      const hourHeight = getAgendaHourHeight(preferences)
      const contentHeight = hourHeight * 24
      const minimumDayWidth = Math.max(
        96,
        config.agenda?.minimumDayWidth ?? 132
      )
      const columnsWidth = minimumDayWidth * span.dates.length
      const scrollRef = useRef<HTMLDivElement | null>(null)
      const canvasRef = useRef<HTMLDivElement | null>(null)
      const initializedScroll = useRef(false)
      const interactions = useCalendarAgendaInteractions(
        canvasRef,
        scrollRef,
        span.dates,
        items
      )
      const timedSegments = useMemo(
        () =>
          layoutAgendaTimedSegments(
            items,
            span.dates,
            config.preferences.timeZone
          ),
        [config.preferences.timeZone, items, span.dates]
      )
      const allDaySegments = useMemo(
        () =>
          layoutAgendaAllDaySegments(
            items,
            span.dates,
            config.preferences.timeZone
          ),
        [config.preferences.timeZone, items, span.dates]
      )
      const orderedItemIds = useMemo(
        () => [
          ...new Set(
            [...allDaySegments, ...timedSegments].map(
              (segment) => segment.item.id
            )
          ),
        ],
        [allDaySegments, timedSegments]
      )
      const maxLane = Math.min(
        config.preferences.maxVisibleLanes,
        Math.max(1, ...allDaySegments.map((segment) => segment.lane + 1))
      )
      const allDayHeight = preferences.showAllDaySection
        ? maxLane * ALL_DAY_LANE_HEIGHT + 8
        : 0
      const current = useCurrentTime(config.now)
      const currentDate = getCalendarDateInTimeZone(
        current,
        config.preferences.timeZone
      )
      const currentMinutes = getWallClockMinutes(
        current,
        config.preferences.timeZone
      )
      const currentIndex = span.dates.indexOf(currentDate)
      const activeDate =
        focusedDate && span.dates.includes(focusedDate)
          ? focusedDate
          : span.dates[0]
      const [focusedMinutes, setFocusedMinutes] = useState(
        () => preferences.initialScrollMinutes
      )

      useEffect(() => {
        if (span.resolvedAnchorDate !== anchorDate) {
          actions.setAnchorDate(span.resolvedAnchorDate)
          config.onAnchorDateChange?.(span.resolvedAnchorDate)
        }
      }, [actions, anchorDate, config, span.resolvedAnchorDate])

      useEffect(() => {
        if (!initializedScroll.current && scrollRef.current) {
          scrollRef.current.scrollTop =
            (preferences.initialScrollMinutes / 60) * hourHeight
          initializedScroll.current = true
        }
      }, [hourHeight, preferences.initialScrollMinutes])

      useEffect(() => {
        actions.announce(
          `Agenda showing ${span.dates.length} day${span.dates.length === 1 ? "" : "s"}, ${span.startDate} through ${span.endDate}.`
        )
      }, [actions, span.dates.length, span.endDate, span.startDate])

      const moveSelected = useCallback(
        (dayDelta: number, minuteDelta: number) => {
          if (config.readOnly) return
          const map = new Map(items.map((item) => [item.id, item]))
          const ranges = selectedIds.flatMap((itemId) => {
            const item = map.get(itemId)
            if (!item) return []
            const previousRange = getCalendarItemRange(item)
            return [
              {
                itemId,
                previousRange,
                nextRange:
                  previousRange.kind === "timed"
                    ? shiftTimedRangeByWallClock(
                        previousRange,
                        dayDelta,
                        minuteDelta,
                        config.preferences.timeZone
                      )
                    : shiftCalendarRangeByDays(
                        previousRange,
                        dayDelta,
                        config.preferences.timeZone
                      ),
              },
            ]
          })
          if (ranges.length)
            commands.commit({
              type: "move",
              clientMutationId: commands.nextMutationId("agenda-keyboard-move"),
              changes: ranges,
            })
        },
        [
          commands,
          config.preferences.timeZone,
          config.readOnly,
          items,
          selectedIds,
        ]
      )

      const handleGridKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
          const snap = preferences.snapMinutes
          if (
            event.altKey &&
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
              event.key
            )
          ) {
            event.preventDefault()
            event.stopPropagation()
            moveSelected(
              event.key === "ArrowLeft"
                ? -1
                : event.key === "ArrowRight"
                  ? 1
                  : 0,
              event.key === "ArrowUp"
                ? -snap
                : event.key === "ArrowDown"
                  ? snap
                  : 0
            )
            return
          }
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault()
            event.stopPropagation()
            setFocusedMinutes((value) =>
              Math.max(
                0,
                Math.min(
                  1440 - snap,
                  value + (event.key === "ArrowUp" ? -snap : snap)
                )
              )
            )
            return
          }
          if (event.key === "PageUp" || event.key === "PageDown") {
            event.preventDefault()
            event.stopPropagation()
            setFocusedMinutes((value) =>
              Math.max(
                0,
                Math.min(1380, value + (event.key === "PageUp" ? -60 : 60))
              )
            )
            return
          }
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault()
            event.stopPropagation()
            const index = span.dates.indexOf(activeDate)
            const nextIndex = Math.max(
              0,
              Math.min(
                span.dates.length - 1,
                index + (event.key === "ArrowLeft" ? -1 : 1)
              )
            )
            actions.setFocusedDate(span.dates[nextIndex])
            return
          }
          if (event.key === "Home" || event.key === "End") {
            event.preventDefault()
            event.stopPropagation()
            setFocusedMinutes(
              event.key === "Home"
                ? event.ctrlKey
                  ? 0
                  : preferences.workingHours.startMinutes
                : event.ctrlKey
                  ? 1440 - snap
                  : preferences.workingHours.endMinutes - snap
            )
            return
          }
          if (
            (event.key === "Enter" || event.key === " ") &&
            !config.readOnly
          ) {
            event.preventDefault()
            event.stopPropagation()
            const start = agendaWallClockToInstant(
              activeDate,
              focusedMinutes,
              config.preferences.timeZone
            )
            const end = agendaWallClockToInstant(
              activeDate,
              focusedMinutes +
                (config.agenda?.defaultTimedDurationMinutes ?? 30),
              config.preferences.timeZone
            )
            if (
              commands.create(
                { kind: "timed", start, end },
                { viewMode: "agenda", source: "keyboard" }
              )
            ) {
              actions.announce(
                `Create calendar item on ${activeDate} at ${formatTime(focusedMinutes, config.locale, config.preferences.timeFormat)}.`
              )
            }
          }
        },
        [
          actions,
          activeDate,
          config,
          commands,
          focusedMinutes,
          moveSelected,
          preferences.snapMinutes,
          preferences.workingHours.endMinutes,
          preferences.workingHours.startMinutes,
          span.dates,
        ]
      )

      const preview =
        interaction.type === "creating" && interaction.preview.kind === "timed"
          ? {
              date: getCalendarDateInTimeZone(
                interaction.preview.start,
                config.preferences.timeZone
              ),
              startMinutes: getWallClockMinutes(
                interaction.preview.start,
                config.preferences.timeZone
              ),
              endMinutes: getWallClockMinutes(
                interaction.preview.end,
                config.preferences.timeZone
              ),
            }
          : null

      return (
        <section
          ref={ref}
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            className
          )}
          aria-label="Agenda calendar"
          {...props}
        >
          <div
            className="shrink-0 overflow-x-auto border-b bg-background"
            data-testid="calendar-agenda-header"
          >
            <div style={{ minWidth: columnsWidth + GUTTER_WIDTH }}>
              <div
                className="grid h-12"
                style={{
                  gridTemplateColumns: `${GUTTER_WIDTH}px repeat(${span.dates.length}, minmax(${minimumDayWidth}px, 1fr))`,
                }}
              >
                <div className="flex items-end justify-center border-r pb-1 text-[9px] text-muted-foreground">
                  {config.preferences.timeZone}
                </div>
                {span.dates.map((date) => {
                  const isToday = date === today
                  return (
                    <div
                      key={date}
                      data-calendar-day-header={date}
                      aria-label={formatCalendarDateLabel(date, config.locale, {
                        dateStyle: "full",
                      })}
                      className={cn(
                        "flex items-center justify-center gap-1 border-r text-xs",
                        isToday && "font-semibold text-primary"
                      )}
                    >
                      {config.agenda?.renderDayHeader?.(date, isToday) ?? (
                        <>
                          <span>
                            {formatCalendarDateLabel(date, config.locale, {
                              weekday: "short",
                            })}
                          </span>
                          <span
                            className={cn(
                              "flex size-6 items-center justify-center rounded-full",
                              isToday && "bg-primary text-primary-foreground"
                            )}
                          >
                            {Number(date.slice(-2))}
                          </span>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
              {preferences.showAllDaySection ? (
                <div
                  className="grid border-t"
                  style={{
                    gridTemplateColumns: `${GUTTER_WIDTH}px minmax(${columnsWidth}px, 1fr)`,
                    minHeight: allDayHeight,
                  }}
                >
                  <div className="border-r px-1 pt-1 text-right text-[9px] text-muted-foreground">
                    All-day
                  </div>
                  <div
                    className="relative"
                    style={{ height: allDayHeight }}
                    role="group"
                    aria-label="All-day events"
                    onPointerDown={(event) =>
                      interactions.beginCreate(event, true)
                    }
                    onPointerMove={interactions.onPointerMove}
                    onPointerUp={interactions.onPointerUp}
                    onPointerCancel={interactions.onPointerCancel}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 grid"
                      style={{
                        gridTemplateColumns: `repeat(${span.dates.length}, 1fr)`,
                      }}
                    >
                      {span.dates.map((date) => (
                        <div key={date} className="border-r" />
                      ))}
                    </div>
                    {allDaySegments
                      .filter((segment) => segment.lane < maxLane)
                      .map((segment) => (
                        <CalendarAgendaEvent
                          key={segment.id}
                          item={segment.item}
                          segmentDate={segment.startDate}
                          continuedBefore={segment.continuedBefore}
                          continuedAfter={segment.continuedAfter}
                          allDay
                          interactions={interactions}
                          orderedItemIds={orderedItemIds}
                          style={{
                            left: `${(segment.startIndex / span.dates.length) * 100}%`,
                            width: `${((segment.endIndex - segment.startIndex + 1) / span.dates.length) * 100}%`,
                            top: segment.lane * ALL_DAY_LANE_HEIGHT + 4,
                            height: ALL_DAY_LANE_HEIGHT - 3,
                          }}
                        />
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-auto"
            data-testid="calendar-agenda-scroll"
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: `${GUTTER_WIDTH}px minmax(${columnsWidth}px, 1fr)`,
                minWidth: columnsWidth + GUTTER_WIDTH,
                height: contentHeight,
              }}
            >
              <div className="relative border-r" aria-hidden="true">
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    className="absolute right-2 -translate-y-1/2 text-[9px] text-muted-foreground"
                    style={{ top: hour * hourHeight }}
                  >
                    {config.agenda?.renderTimeLabel?.(hour * 60) ??
                      formatTime(
                        hour * 60,
                        config.locale,
                        config.preferences.timeFormat
                      )}
                  </div>
                ))}
              </div>
              <div
                ref={canvasRef}
                role="group"
                aria-label={`${span.dates.length}-day time grid`}
                tabIndex={0}
                data-calendar-date={activeDate}
                data-read-only={config.readOnly || undefined}
                data-testid="calendar-agenda-grid"
                className="relative outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                style={{ height: contentHeight }}
                onFocus={() => actions.setFocusedDate(activeDate)}
                onKeyDown={handleGridKeyDown}
                onPointerDown={(event) => interactions.beginCreate(event)}
                onPointerMove={interactions.onPointerMove}
                onPointerUp={interactions.onPointerUp}
                onPointerCancel={interactions.onPointerCancel}
              >
                <div
                  className="pointer-events-none absolute inset-0 grid"
                  style={{
                    gridTemplateColumns: `repeat(${span.dates.length}, 1fr)`,
                  }}
                  aria-hidden="true"
                >
                  {span.dates.map((date) => (
                    <div
                      key={date}
                      className="relative border-r"
                      style={{
                        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${hourHeight / 2 - 1}px, color-mix(in oklab, var(--border) 45%, transparent) ${hourHeight / 2}px, transparent ${hourHeight / 2 + 1}px, transparent ${hourHeight - 1}px, var(--border) ${hourHeight}px)`,
                      }}
                    >
                      <div
                        className="absolute inset-x-0 bg-muted/20"
                        style={{
                          top:
                            (preferences.workingHours.endMinutes / 60) *
                            hourHeight,
                          bottom: 0,
                        }}
                      />
                      <div
                        className="absolute inset-x-0 top-0 bg-muted/20"
                        style={{
                          height:
                            (preferences.workingHours.startMinutes / 60) *
                            hourHeight,
                        }}
                      />
                    </div>
                  ))}
                </div>
                {timedSegments.map((segment) => {
                  const dayIndex = span.dates.indexOf(segment.date)
                  const dayWidth = 100 / span.dates.length
                  const columnWidth = dayWidth / segment.columnCount
                  return (
                    <CalendarAgendaEvent
                      key={segment.id}
                      item={segment.item}
                      segmentDate={segment.date}
                      continuedBefore={segment.continuedBefore}
                      continuedAfter={segment.continuedAfter}
                      interactions={interactions}
                      orderedItemIds={orderedItemIds}
                      style={{
                        left: `calc(${dayIndex * dayWidth + segment.column * columnWidth}% + 2px)`,
                        width: `calc(${segment.columnSpan * columnWidth}% - 4px)`,
                        top: (segment.startMinutes / 60) * hourHeight + 1,
                        height: Math.max(
                          20,
                          ((segment.endMinutes - segment.startMinutes) / 60) *
                            hourHeight -
                            2
                        ),
                      }}
                    />
                  )
                })}
                {preview && span.dates.includes(preview.date) ? (
                  <div
                    className="pointer-events-none absolute z-50 rounded border border-dashed border-primary bg-primary/10"
                    style={{
                      left: `${(span.dates.indexOf(preview.date) / span.dates.length) * 100}%`,
                      width: `${100 / span.dates.length}%`,
                      top: (preview.startMinutes / 60) * hourHeight,
                      height: Math.max(
                        2,
                        ((preview.endMinutes - preview.startMinutes) / 60) *
                          hourHeight
                      ),
                    }}
                  />
                ) : null}
                <div
                  id="calendar-agenda-active-slot"
                  role="status"
                  aria-label={`${formatCalendarDateLabel(activeDate, config.locale, { dateStyle: "full" })}, ${formatTime(focusedMinutes, config.locale, config.preferences.timeFormat)}, ${config.preferences.timeZone}`}
                  className="pointer-events-none absolute z-20 border border-dashed border-ring/70 bg-ring/5 opacity-0 focus-within:opacity-100"
                  style={{
                    left: `${(span.dates.indexOf(activeDate) / span.dates.length) * 100}%`,
                    width: `${100 / span.dates.length}%`,
                    top: (focusedMinutes / 60) * hourHeight,
                    height: Math.max(
                      2,
                      (preferences.snapMinutes / 60) * hourHeight
                    ),
                  }}
                />
                {currentIndex >= 0 ? (
                  <div
                    className="pointer-events-none absolute z-50 h-px bg-destructive"
                    style={{
                      left: `${(currentIndex / span.dates.length) * 100}%`,
                      width: `${100 / span.dates.length}%`,
                      top: (currentMinutes / 60) * hourHeight,
                    }}
                    aria-label={`Current time ${formatTime(currentMinutes, config.locale, config.preferences.timeFormat)}`}
                    role="separator"
                  >
                    <span className="absolute -left-0.5 size-2 -translate-y-1/2 rounded-full bg-destructive" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      )
    }
  )
)
