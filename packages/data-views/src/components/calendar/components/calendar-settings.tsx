import React from "react"
import { Settings } from "lucide-react"
import { useCalendarConfig } from "../context/calendar-config-context.js"
import { useCalendarPreferencesChange } from "../hooks/use-calendar-preferences.js"
import { useCalendarStore } from "../hooks/use-calendar-store.js"
import {
  selectActions,
  selectSettingsOpen,
} from "../store/selectors.js"
import type {
  CalendarDensity,
  CalendarAgendaSnapMinutes,
  CalendarOverflowBehavior,
  CalendarTimeFormat,
  CalendarWeekStartsOn,
} from "../types.js"
import { Button } from "../../ui/button.js"
import { Checkbox } from "../../ui/checkbox.js"
import { Label } from "../../ui/label.js"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select.js"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../ui/sheet.js"
import { Switch } from "../../ui/switch.js"
import { cn } from "../../../lib/utils.js"
import { CALENDAR_NO_VISIBLE_SOURCES } from "../constants.js"

type SettingRowProps = React.ComponentProps<"div"> & {
  readonly label: string
  readonly description: string
}

const SettingRow = React.memo(
  React.forwardRef<HTMLDivElement, SettingRowProps>(function SettingRow(
    { label, description, className, children, ...props },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-3 border-b px-5 py-3 last:border-b-0",
          className
        )}
        {...props}
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">{label}</p>
          <p className="text-[10px] leading-4 text-muted-foreground">
            {description}
          </p>
        </div>
        {children}
      </div>
    )
  })
)

export const CalendarSettings = React.memo(function CalendarSettings() {
  const { items, preferences } = useCalendarConfig()
  const open = useCalendarStore(selectSettingsOpen)
  const actions = useCalendarStore(selectActions)
  const changePreferences = useCalendarPreferencesChange()
  const calendarIds = [
    ...new Set(items.flatMap((item) => item.calendarId ?? [])),
  ]

  const changeVisibleCalendar = (calendarId: string, visible: boolean) => {
    const explicitlyFiltered = preferences.visibleCalendarIds.length > 0
    const current = new Set(
      explicitlyFiltered
        ? preferences.visibleCalendarIds.filter((id) => id !== CALENDAR_NO_VISIBLE_SOURCES)
        : calendarIds
    )
    if (visible) current.add(calendarId)
    else current.delete(calendarId)
    changePreferences({
      type: "visible-calendars",
      value: current.size > 0 ? [...current] : [CALENDAR_NO_VISIBLE_SOURCES],
    })
  }

  return (
    <Sheet open={open} onOpenChange={actions.setSettingsOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            className="bg-background shadow-xs"
            aria-label="Open calendar settings"
            data-testid="calendar-settings-trigger"
          >
            <Settings aria-hidden="true" />
          </Button>
        }
      />
      <SheetContent
        side="right"
        className="w-[min(92vw,390px)] gap-0 bg-background/95 p-0 backdrop-blur-xl sm:max-w-[390px]"
        data-testid="calendar-settings-panel"
      >
        <SheetHeader className="border-b px-5 py-4 pr-14">
          <SheetTitle>Calendar settings</SheetTitle>
          <SheetDescription>
            Adjust the controlled calendar view.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-2">
          <SettingRow
            label="Weekends"
            description="Show Saturday and Sunday columns."
          >
            <Switch
              checked={preferences.showWeekends}
              onCheckedChange={(value) =>
                changePreferences({ type: "weekends", value })
              }
              aria-label="Show weekends"
            />
          </SettingRow>
          {preferences.viewMode === "agenda" ? (
            <>
              <SettingRow label="Agenda snap" description="Pointer and keyboard time increment.">
                <Select
                  value={String(preferences.agenda.snapMinutes)}
                  onValueChange={(value) => value && changePreferences({ type: "agenda-snap", value: Number(value) as CalendarAgendaSnapMinutes })}
                >
                  <SelectTrigger className="w-20" aria-label="Agenda snap interval"><SelectValue>{preferences.agenda.snapMinutes} min</SelectValue></SelectTrigger>
                  <SelectContent>
                    {([5, 10, 15, 30, 60] as const).map((value) => <SelectItem key={value} value={String(value)}>{value} min</SelectItem>)}
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow label="Hour height" description="Vertical agenda scale.">
                <Select
                  value={String(preferences.agenda.hourHeight)}
                  onValueChange={(value) => value && changePreferences({ type: "agenda-hour-height", value: Number(value) })}
                >
                  <SelectTrigger className="w-20" aria-label="Agenda hour height"><SelectValue>{preferences.agenda.hourHeight}px</SelectValue></SelectTrigger>
                  <SelectContent>
                    {[40, 48, 64, 80, 96, 120].map((value) => <SelectItem key={value} value={String(value)}>{value}px</SelectItem>)}
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow label="All-day section" description="Show all-day and multi-day records.">
                <Switch
                  checked={preferences.agenda.showAllDaySection}
                  onCheckedChange={(value) => changePreferences({ type: "agenda-all-day-section", value })}
                  aria-label="Show agenda all-day section"
                />
              </SettingRow>
            </>
          ) : null}
          <SettingRow
            label="Week starts"
            description="Choose the first weekday."
          >
            <Select
              value={String(preferences.weekStartsOn)}
              onValueChange={(value) => {
                if (value !== null) {
                  changePreferences({
                    type: "week-start",
                    value: Number(value) as CalendarWeekStartsOn,
                  })
                }
              }}
            >
              <SelectTrigger className="w-24" aria-label="Week starts on">
                <SelectValue>
                  {preferences.weekStartsOn === 0 ? "Sunday" : "Monday"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sunday</SelectItem>
                <SelectItem value="1">Monday</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label="Density" description="Set event and row spacing.">
            <Select
              value={preferences.density}
              onValueChange={(value: CalendarDensity | null) => {
                if (value) changePreferences({ type: "density", value })
              }}
            >
              <SelectTrigger className="w-28" aria-label="Calendar density">
                <SelectValue>{preferences.density}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="comfortable">Comfortable</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow
            label="Visible lanes"
            description="Events shown before overflow."
          >
            <Select
              value={String(preferences.maxVisibleLanes)}
              onValueChange={(value) => {
                if (value)
                  changePreferences({
                    type: "max-visible-lanes",
                    value: Number(value),
                  })
              }}
            >
              <SelectTrigger
                className="w-20"
                aria-label="Maximum visible event lanes"
              >
                <SelectValue>{preferences.maxVisibleLanes}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow
            label="Overflow"
            description="Open a popover or grow the week row."
          >
            <Select
              value={preferences.overflowBehavior}
              onValueChange={(value: CalendarOverflowBehavior | null) => {
                if (value)
                  changePreferences({ type: "overflow-behavior", value })
              }}
            >
              <SelectTrigger className="w-28" aria-label="Overflow behavior">
                <SelectValue>
                  {preferences.overflowBehavior === "popover"
                    ? "Popover"
                    : "Expand"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popover">Popover</SelectItem>
                <SelectItem value="expand-week">Expand week</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow
            label="Time format"
            description="Format timed item labels."
          >
            <Select
              value={preferences.timeFormat}
              onValueChange={(value: CalendarTimeFormat | null) => {
                if (value) changePreferences({ type: "time-format", value })
              }}
            >
              <SelectTrigger className="w-20" aria-label="Time format">
                <SelectValue>{preferences.timeFormat}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12h</SelectItem>
                <SelectItem value="24h">24h</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow
            label="Time zone"
            description="Render timed events in this IANA zone."
          >
            <Select
              value={preferences.timeZone}
              onValueChange={(value) => {
                if (value) changePreferences({ type: "time-zone", value })
              }}
            >
              <SelectTrigger className="w-40" aria-label="Calendar time zone">
                <SelectValue>{preferences.timeZone}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {[
                  ...new Set([
                    preferences.timeZone,
                    "UTC",
                    "America/Los_Angeles",
                    "America/New_York",
                    "Europe/London",
                    "Asia/Tokyo",
                  ]),
                ].map((timeZone) => (
                  <SelectItem key={timeZone} value={timeZone}>
                    {timeZone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
          {calendarIds.length > 0 ? (
            <div className="space-y-2 px-5 py-4">
              <p className="text-xs font-medium">Calendars</p>
              {calendarIds.map((calendarId) => {
                const checked =
                  preferences.visibleCalendarIds.length === 0 ||
                  (!preferences.visibleCalendarIds.includes(CALENDAR_NO_VISIBLE_SOURCES) &&
                    preferences.visibleCalendarIds.includes(calendarId))
                return (
                  <Label
                    key={calendarId}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        changeVisibleCalendar(calendarId, value)
                      }
                    />
                    {calendarId}
                  </Label>
                )
              })}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
})
