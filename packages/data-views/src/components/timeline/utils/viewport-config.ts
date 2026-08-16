/**
 * Viewport configuration utilities.
 *
 * Provides helpers to look up per-mode config, navigate between
 * zoom levels, and retrieve column/snap/header details.
 */
import {
  VIEWPORT_MODE_CONFIGS,
  VIEWPORT_MODES_ORDERED,
  type ViewportModeConfig,
} from "../constants.js"
import type { ViewportMode } from "../types.js"

/**
 * Get the full configuration for a given viewport mode.
 *
 * @param mode - The viewport mode
 * @returns The configuration object for that mode
 */
export function getViewportConfig(mode: ViewportMode): ViewportModeConfig {
  return VIEWPORT_MODE_CONFIGS[mode]
}

/**
 * Get the column width in pixels for a given viewport mode.
 *
 * @param mode - The viewport mode
 * @returns Column width in pixels
 */
export function getColumnWidth(mode: ViewportMode): number {
  return VIEWPORT_MODE_CONFIGS[mode].columnWidthPx
}

/** Pixel width of one calendar day at the selected zoom level. */
export function getDayWidth(mode: ViewportMode): number {
  const config = VIEWPORT_MODE_CONFIGS[mode]
  return config.columnUnit === "quarter-hour"
    ? config.columnWidthPx * 96
    : config.columnWidthPx
}

/** Number of timeline columns represented by a requested pixel span. */
export function getColumnCountForPixels(
  mode: ViewportMode,
  pixels: number
): number {
  return Math.max(1, Math.ceil(pixels / getColumnWidth(mode)))
}

/** Whether a date receives a visible secondary header label. */
export function shouldRenderHeaderLabel(
  date: Date,
  mode: ViewportMode
): boolean {
  if (mode === "hours") return date.getMinutes() % 30 === 0
  const step = VIEWPORT_MODE_CONFIGS[mode].dayLabelStep
  return (date.getDate() - 1) % step === 0
}

/** Whether a column boundary extends vertically through the timeline grid. */
export function shouldRenderColumnGuide(
  date: Date,
  mode: ViewportMode
): boolean {
  if (mode === "hours") return date.getMinutes() % 30 === 0
  if (mode === "day" || mode === "week" || mode === "bi-week") return true
  if (mode === "month") return false
  return date.getDate() === 1
}

/**
 * Zoom in to a finer viewport mode (e.g. `week` → `day`).
 * Returns the current mode if already at the finest level.
 *
 * @param current - The current viewport mode
 * @returns The next finer viewport mode, or `current` if already finest
 */
export function zoomIn(current: ViewportMode): ViewportMode {
  const index = VIEWPORT_MODES_ORDERED.indexOf(current)
  if (index <= 0) return current
  return VIEWPORT_MODES_ORDERED[index - 1]
}

/**
 * Zoom out to a coarser viewport mode (e.g. `week` → `bi-week`).
 * Returns the current mode if already at the coarsest level.
 *
 * @param current - The current viewport mode
 * @returns The next coarser viewport mode, or `current` if already coarsest
 */
export function zoomOut(current: ViewportMode): ViewportMode {
  const index = VIEWPORT_MODES_ORDERED.indexOf(current)
  if (index >= VIEWPORT_MODES_ORDERED.length - 1) return current
  return VIEWPORT_MODES_ORDERED[index + 1]
}

/**
 * Check whether the mode is at the finest zoom level (hours).
 *
 * @param mode - The viewport mode to check
 * @returns `true` if the mode is the finest available
 */
export function isFinestMode(mode: ViewportMode): boolean {
  return VIEWPORT_MODES_ORDERED.indexOf(mode) === 0
}

/**
 * Check whether the mode is at the coarsest zoom level (`year`).
 *
 * @param mode - The viewport mode to check
 * @returns `true` if the mode is the coarsest available
 */
export function isCoarsestMode(mode: ViewportMode): boolean {
  return (
    VIEWPORT_MODES_ORDERED.indexOf(mode) === VIEWPORT_MODES_ORDERED.length - 1
  )
}
