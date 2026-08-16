import React from "react"
import { useCalendarConfig } from "../../context/calendar-config-context.js"
import { useCalendarPreferencesChange } from "../../hooks/use-calendar-preferences.js"
import type { CalendarAgendaDayCount, CalendarAgendaSpan } from "../../types.js"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select.js"
import { cn } from "../../../../lib/utils.js"

const OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  ...([2, 3, 4, 5, 6, 7, 8, 9] as const).map((dayCount) => ({ value: `custom-${dayCount}` as const, label: `${dayCount} days` })),
] as const

function serialize(span: CalendarAgendaSpan): string {
  return span.type === "custom" ? `custom-${span.dayCount}` : span.type
}

function parse(value: string): CalendarAgendaSpan {
  if (value === "day" || value === "week") return { type: value }
  return { type: "custom", dayCount: Number(value.slice("custom-".length)) as CalendarAgendaDayCount }
}

export type CalendarAgendaSpanSelectProps = { readonly className?: string }

export const CalendarAgendaSpanSelect = React.memo(function CalendarAgendaSpanSelect({ className }: CalendarAgendaSpanSelectProps) {
  const { preferences } = useCalendarConfig()
  const changePreferences = useCalendarPreferencesChange()
  return (
    <Select value={serialize(preferences.agenda.span)} onValueChange={(value) => value && changePreferences({ type: "agenda-span", value: parse(value) })}>
      <SelectTrigger className={cn("h-8 w-[92px] bg-background shadow-xs", className)} aria-label="Agenda span">
        <SelectValue>{OPTIONS.find((option) => option.value === serialize(preferences.agenda.span))?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
})
