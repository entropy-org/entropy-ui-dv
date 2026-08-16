/**
 * Type-safe store consumer hook.
 *
 * Must be used inside a `<TimelineProvider>`. Always requires a selector
 * to prevent full-store subscriptions (per AGENTS.md: never export a hook
 * that calls useStore() with no selector).
 */
import { useContext } from "react"
import { useStore } from "zustand"
import { TimelineContext } from "../context/timeline-context.js"
import type { TimelineState } from "../types.js"

/**
 * Access the timeline store with a selector.
 *
 * @param selector - A function that selects the needed slice of state
 * @returns The selected slice
 * @throws If used outside a `<TimelineProvider>`
 *
 * @example
 * ```tsx
 * const mode = useTimelineStore(state => state.viewportMode);
 * const actions = useTimelineStore(state => state.actions);
 * ```
 */
export function useTimelineStore<T>(selector: (state: TimelineState) => T): T {
  const store = useContext(TimelineContext)
  if (!store) {
    throw new Error("useTimelineStore must be used within a <TimelineProvider>")
  }
  return useStore(store, selector)
}
