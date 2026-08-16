import React from "react"
import { CalendarDays } from "lucide-react"
import { useCalendarConfig } from "../context/calendar-config-context.js"
import { useCalendarPreferencesChange } from "../hooks/use-calendar-preferences.js"
import type { CalendarViewMode } from "../types.js"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select.js"
import { cn } from "../../../lib/utils.js"

const VIEW_OPTIONS = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "agenda", label: "Agenda" },
] as const

export type CalendarViewSelectProps = {
  readonly className?: string
}

export const CalendarViewSelect = React.memo(function CalendarViewSelect({
  className,
}: CalendarViewSelectProps) {
  const { preferences } = useCalendarConfig()
  const changePreferences = useCalendarPreferencesChange()
  return (
    <Select
      value={preferences.viewMode}
      onValueChange={(value: CalendarViewMode | null) => {
        if (value) changePreferences({ type: "view-mode", value })
      }}
    >
      <SelectTrigger
        className={cn("h-8 w-[112px] bg-background shadow-xs", className)}
        aria-label="Calendar view"
        data-testid="calendar-view-select"
      >
        <CalendarDays className="text-muted-foreground" aria-hidden="true" />
        <SelectValue>
          {preferences.viewMode === "month"
            ? "Month"
            : preferences.viewMode === "week"
              ? "Week"
              : "Agenda"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {VIEW_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
})
