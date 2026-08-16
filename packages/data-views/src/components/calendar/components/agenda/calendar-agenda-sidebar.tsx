import React, { useCallback, useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { useCalendarConfig } from "../../context/calendar-config-context.js"
import { useCalendarNavigationActions } from "../../hooks/use-calendar-navigation.js"
import { useCalendarPreferencesChange } from "../../hooks/use-calendar-preferences.js"
import { useCalendarStore } from "../../hooks/use-calendar-store.js"
import { selectAnchorDate } from "../../store/selectors.js"
import type {
  CalendarAgendaSidebarConfig,
  CalendarDate,
} from "../../types.js"
import {
  addCalendarDays,
  formatCalendarDateLabel,
  getDayOfWeek,
  startOfMonth,
} from "../../utils/date-engine.js"
import { Button } from "../../../ui/button.js"
import { Checkbox } from "../../../ui/checkbox.js"
import { cn } from "../../../../lib/utils.js"
import { CALENDAR_NO_VISIBLE_SOURCES } from "../../constants.js"
import { normalizeCalendarSources } from "../../utils/data-integration.js"

const MIN_WIDTH = 180
const MAX_WIDTH = 420

export type CalendarAgendaSidebarProps = React.ComponentProps<"aside"> & {
  readonly config: Exclude<
    CalendarAgendaSidebarConfig,
    { readonly type: "hidden" }
  >
}

export const CalendarAgendaSidebar = React.memo(
  React.forwardRef<HTMLElement, CalendarAgendaSidebarProps>(
    function CalendarAgendaSidebar(
      { config: sidebar, className, ...props },
      ref
    ) {
      const config = useCalendarConfig()
      const navigation = useCalendarNavigationActions()
      const anchorDate = useCalendarStore(selectAnchorDate)
      const changePreferences = useCalendarPreferencesChange()
      const [open, setOpen] = useState(true)
      const [width, setWidth] = useState(() =>
        Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, sidebar.defaultWidth ?? 232))
      )
      const calendarSources = useMemo(
        () =>
          sidebar.type === "default"
            ? normalizeCalendarSources(sidebar.calendars).sources.filter(
                (source) => source.permissions?.view !== false
              )
            : [],
        [sidebar]
      )

      const resize = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
          if (!sidebar.resizable) return
          const origin = event.clientX
          const originalWidth = width
          event.currentTarget.setPointerCapture(event.pointerId)
          const target = event.currentTarget
          const move = (pointerEvent: PointerEvent) =>
            setWidth(
              Math.max(
                MIN_WIDTH,
                Math.min(
                  MAX_WIDTH,
                  originalWidth + pointerEvent.clientX - origin
                )
              )
            )
          const end = () => {
            target.removeEventListener("pointermove", move)
            target.removeEventListener("pointerup", end)
            target.removeEventListener("pointercancel", end)
          }
          target.addEventListener("pointermove", move)
          target.addEventListener("pointerup", end)
          target.addEventListener("pointercancel", end)
        },
        [sidebar.resizable, width]
      )

      if (!open) {
        return (
          <aside
            ref={ref}
            className={cn(
              "flex w-10 shrink-0 justify-center border-r bg-muted/15 py-2",
              className
            )}
            {...props}
          >
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Open agenda sidebar"
              onClick={() => setOpen(true)}
            >
              <PanelLeftOpen aria-hidden="true" />
            </Button>
          </aside>
        )
      }

      const visibleIds = config.preferences.visibleCalendarIds
      const toggleSource = (id: string, visible: boolean) => {
        if (sidebar.type !== "default") return
        const allIds = calendarSources
          .filter((source) => !source.disabled)
          .map((source) => source.id)
        const next = new Set(
          visibleIds.length && !visibleIds.includes(CALENDAR_NO_VISIBLE_SOURCES)
            ? visibleIds
            : visibleIds.includes(CALENDAR_NO_VISIBLE_SOURCES)
              ? []
              : allIds
        )
        if (visible) next.add(id)
        else next.delete(id)
        changePreferences({
          type: "visible-calendars",
          value: next.size > 0 ? [...next] : [CALENDAR_NO_VISIBLE_SOURCES],
        })
      }

      return (
        <aside
          ref={ref}
          className={cn(
            "relative flex shrink-0 flex-col overflow-hidden border-r bg-muted/10",
            className
          )}
          style={{ width }}
          aria-label="Agenda sidebar"
          {...props}
        >
          <div className="flex h-12 items-center justify-between border-b px-3">
            <span className="text-xs font-semibold">Calendars</span>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Close agenda sidebar"
              onClick={() => setOpen(false)}
            >
              <PanelLeftClose aria-hidden="true" />
            </Button>
          </div>
          {sidebar.type === "custom" ? (
            <div className="min-h-0 flex-1 overflow-auto">
              {sidebar.render({
                anchorDate,
                navigateToDate: navigation.toDate,
                close: () => setOpen(false),
              })}
            </div>
          ) : (
            <>
              {sidebar.showMiniMonth !== false ? (
                <MiniMonth
                  anchorDate={anchorDate}
                  onNavigate={navigation.toDate}
                  locale={config.locale}
                />
              ) : null}
              <div
                className="min-h-0 flex-1 space-y-1 overflow-auto border-t p-3"
                aria-label="Calendar sources"
              >
                {calendarSources.map((source) => {
                  const visible =
                    visibleIds.length === 0 ||
                    (!visibleIds.includes(CALENDAR_NO_VISIBLE_SOURCES) &&
                      visibleIds.includes(source.id))
                  return (
                    <label
                      key={source.id}
                      className="flex min-h-8 items-center gap-2 rounded-md px-2 text-xs hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={visible}
                        disabled={source.disabled}
                        onCheckedChange={(checked) =>
                          toggleSource(source.id, checked)
                        }
                        aria-label={`Show ${source.label}`}
                      />
                      <span
                        className="size-2 rounded-full"
                        style={{
                          backgroundColor: source.color ?? "currentColor",
                        }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {sidebar.renderCalendarSource?.(source, {
                          visible,
                          disabled: source.disabled ?? false,
                        }) ?? source.label}
                      </span>
                    </label>
                  )
                })}
              </div>
            </>
          )}
          {sidebar.resizable ? (
            <div
              role="separator"
              aria-label="Resize agenda sidebar"
              aria-orientation="vertical"
              aria-valuemin={MIN_WIDTH}
              aria-valuemax={MAX_WIDTH}
              aria-valuenow={width}
              className="absolute inset-y-0 right-0 z-20 w-1 cursor-col-resize hover:bg-primary/40"
              onPointerDown={resize}
            />
          ) : null}
        </aside>
      )
    }
  )
)

const MiniMonth = React.memo(function MiniMonth({
  anchorDate,
  onNavigate,
  locale,
}: {
  readonly anchorDate: CalendarDate
  readonly onNavigate: (date: CalendarDate) => void
  readonly locale?: string
}) {
  const monthStart = startOfMonth(anchorDate)
  const gridStart = addCalendarDays(monthStart, -getDayOfWeek(monthStart))
  const dates = Array.from({ length: 42 }, (_, index) =>
    addCalendarDays(gridStart, index)
  )
  const month = monthStart.slice(0, 7)
  return (
    <div className="p-3" aria-label="Mini month">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold">
          {formatCalendarDateLabel(monthStart, locale, {
            month: "long",
            year: "numeric",
          })}
        </span>
        <div className="flex">
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Previous month"
            onClick={() => onNavigate(addCalendarDays(monthStart, -1))}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Next month"
            onClick={() =>
              onNavigate(addCalendarDays(dates[dates.length - 1], 1))
            }
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div
        className="grid grid-cols-7 text-center text-[9px] text-muted-foreground"
        aria-hidden="true"
      >
        {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dates.map((date) => (
          <button
            key={date}
            type="button"
            className={cn(
              "aspect-square rounded text-[10px] hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
              date.slice(0, 7) !== month && "text-muted-foreground",
              date === anchorDate &&
                "bg-primary text-primary-foreground hover:bg-primary"
            )}
            aria-label={formatCalendarDateLabel(date, locale, {
              dateStyle: "full",
            })}
            onClick={() => onNavigate(date)}
          >
            {Number(date.slice(-2))}
          </button>
        ))}
      </div>
    </div>
  )
})
