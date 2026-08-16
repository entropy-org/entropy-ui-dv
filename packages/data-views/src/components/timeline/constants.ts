/** Shared timeline viewport, layout, and range-extension settings. */
import type { ViewportMode } from "./types.js"

/** Defines the time density and header treatment for one zoom level. */
export interface ViewportModeConfig {
  readonly mode: ViewportMode
  readonly columnUnit: "quarter-hour" | "day"
  readonly columnWidthPx: number
  readonly primaryHeaderUnit: "day" | "month"
  readonly secondaryHeaderUnit: "quarter-hour" | "day"
  readonly snapUnit: "15min" | "day"
  readonly dayLabelStep: number
  readonly shadeWeekends: boolean
}

/**
 * Hours use quarter-hour columns. Every other mode remains calendar-day
 * based; zoom only changes the pixels allocated to each day.
 *
 * Widths decrease with each broader mode so adjacent zoom levels retain a
 * predictable scale hierarchy while allowing horizontal exploration.
 */
export const VIEWPORT_MODE_CONFIGS: Record<ViewportMode, ViewportModeConfig> = {
  hours: {
    mode: "hours",
    columnUnit: "quarter-hour",
    columnWidthPx: 40,
    primaryHeaderUnit: "day",
    secondaryHeaderUnit: "quarter-hour",
    snapUnit: "15min",
    dayLabelStep: 1,
    shadeWeekends: true,
  },
  day: {
    mode: "day",
    columnUnit: "day",
    columnWidthPx: 240,
    primaryHeaderUnit: "month",
    secondaryHeaderUnit: "day",
    snapUnit: "day",
    dayLabelStep: 1,
    shadeWeekends: true,
  },
  week: {
    mode: "week",
    columnUnit: "day",
    columnWidthPx: 120,
    primaryHeaderUnit: "month",
    secondaryHeaderUnit: "day",
    snapUnit: "day",
    dayLabelStep: 1,
    shadeWeekends: true,
  },
  "bi-week": {
    mode: "bi-week",
    columnUnit: "day",
    columnWidthPx: 60,
    primaryHeaderUnit: "month",
    secondaryHeaderUnit: "day",
    snapUnit: "day",
    dayLabelStep: 1,
    shadeWeekends: true,
  },
  month: {
    mode: "month",
    columnUnit: "day",
    columnWidthPx: 48,
    primaryHeaderUnit: "month",
    secondaryHeaderUnit: "day",
    snapUnit: "day",
    dayLabelStep: 1,
    shadeWeekends: true,
  },
  quarter: {
    mode: "quarter",
    columnUnit: "day",
    columnWidthPx: 11,
    primaryHeaderUnit: "month",
    secondaryHeaderUnit: "day",
    snapUnit: "day",
    dayLabelStep: 8,
    shadeWeekends: false,
  },
  year: {
    mode: "year",
    columnUnit: "day",
    columnWidthPx: 6,
    primaryHeaderUnit: "month",
    secondaryHeaderUnit: "day",
    snapUnit: "day",
    dayLabelStep: 8,
    shadeWeekends: false,
  },
} as const

/** All viewport modes in zoom order (finest → coarsest) */
export const VIEWPORT_MODES_ORDERED: readonly ViewportMode[] = [
  "hours",
  "day",
  "week",
  "bi-week",
  "month",
  "quarter",
  "year",
] as const

// ── Defaults ─────────────────────────────────────────────────────────────────

/** Default viewport mode when none is specified */
export const DEFAULT_VIEWPORT_MODE: ViewportMode = "week"

/** Default row height in pixels */
export const DEFAULT_ROW_HEIGHT = 40

/** Default sidebar width in pixels */
export const DEFAULT_SIDEBAR_WIDTH = 240

/** Minimum sidebar width during resize */
export const MIN_SIDEBAR_WIDTH = 120

/** Maximum sidebar width during resize */
export const MAX_SIDEBAR_WIDTH = 500

// ── Limits ───────────────────────────────────────────────────────────────────

/** Maximum number of undo history entries */
export const MAX_UNDO_HISTORY = 50

/** Buffer rows rendered above/below the viewport for virtualization */
export const VIRTUAL_ROW_BUFFER = 5

/** Buffer columns rendered left/right of the viewport for virtualization */
export const VIRTUAL_COLUMN_BUFFER = 3

/** Initial pixel space kept before and after item bounds. */
export const TIMELINE_INITIAL_PADDING_PX = 800

/** Pixel span added whenever scrolling approaches either canvas edge. */
export const TIMELINE_EXTENSION_TARGET_PX = 2400

/** Distance from a canvas edge that triggers range extension. */
export const TIMELINE_EXTENSION_THRESHOLD_PX = 320
