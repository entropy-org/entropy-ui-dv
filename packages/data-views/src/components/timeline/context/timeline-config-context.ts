/**
 * Timeline config context — provides renderer functions and callbacks.
 *
 * Separated from the Zustand store because functions/callbacks are
 * not serializable and should not live in Zustand state (per AGENTS.md).
 * Consumers provide `renderBar`, `renderSidebarItem`, `renderTooltip`,
 * and all `on*` callbacks via this context.
 */
import { createContext, useContext } from "react"
import type { TimelineConfig } from "../types.js"

/**
 * React context holding the consumer-provided config (renderers + callbacks).
 * `null` when outside a `<TimelineProvider>`.
 */
export const TimelineConfigContext = createContext<TimelineConfig | null>(null)

/**
 * Access the timeline config context.
 *
 * @returns The consumer-provided config
 * @throws If used outside a `<TimelineProvider>`
 */
export function useTimelineConfig(): TimelineConfig {
  const config = useContext(TimelineConfigContext)
  if (!config) {
    throw new Error(
      "useTimelineConfig must be used within a <TimelineProvider>"
    )
  }
  return config
}
