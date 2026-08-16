/**
 * Timeline React context definition.
 *
 * Provides the Zustand store instance to the component tree.
 * Each `<TimelineProvider>` creates its own store, enabling
 * multiple independent timeline instances on the same page.
 */
import { createContext } from "react"
import type { TimelineStore } from "../store/create-store.js"

/**
 * React context holding a reference to the timeline store.
 * `null` when outside a `<TimelineProvider>`.
 */
export const TimelineContext = createContext<TimelineStore | null>(null)
