import React, { useCallback } from "react"
import { ZoomIn } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select.js"
import { VIEWPORT_MODES_ORDERED } from "../constants.js"
import { useTimelineConfig } from "../context/timeline-config-context.js"
import { useTimelineStore } from "../hooks/use-timeline-store.js"
import type { ViewportMode } from "../types.js"
import { cn } from "../../../lib/utils.js"

const VIEWPORT_MODE_LABELS: Record<ViewportMode, string> = {
  hours: "Hours",
  day: "Day",
  week: "Week",
  "bi-week": "Bi-week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
}

type TimelineViewportSelectProps = {
  className?: string
  showIcon?: boolean
  testIdPrefix?: string
}

export const TimelineViewportSelect = React.memo(
  function TimelineViewportSelect({
    className,
    showIcon = true,
    testIdPrefix = "timeline",
  }: TimelineViewportSelectProps) {
    const viewportMode = useTimelineStore((state) => state.viewportMode)
    const setViewportMode = useTimelineStore(
      (state) => state.actions.setViewportMode
    )
    const { onViewportModeChange } = useTimelineConfig()

    const handleModeChange = useCallback(
      (mode: ViewportMode | null) => {
        if (!mode) return
        setViewportMode(mode)
        onViewportModeChange?.(mode)
      },
      [onViewportModeChange, setViewportMode]
    )

    return (
      <Select value={viewportMode} onValueChange={handleModeChange}>
        <SelectTrigger
          className={cn("w-[116px] bg-background shadow-xs", className)}
          data-testid={`${testIdPrefix}-mode-select`}
          aria-label="Timeline zoom level"
        >
          {showIcon && (
            <ZoomIn className="text-muted-foreground" aria-hidden="true" />
          )}
          <SelectValue>{VIEWPORT_MODE_LABELS[viewportMode]}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {VIEWPORT_MODES_ORDERED.map((mode) => (
            <SelectItem
              key={mode}
              value={mode}
              data-testid={`${testIdPrefix}-mode-${mode}`}
            >
              {VIEWPORT_MODE_LABELS[mode]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
)
