/**
 * TimelineProvider — creates and provides a store instance for each timeline.
 *
 * Wraps children in both `TimelineContext.Provider` (Zustand store) and
 * `TimelineConfigContext.Provider` (renderers + callbacks) so the entire
 * component tree has access to both data and rendering functions.
 */
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { TimelineContext } from "./timeline-context.js"
import { TimelineConfigContext } from "./timeline-config-context.js"
import { TimelineMutationContext } from "./timeline-mutation-context.js"
import { createTimelineStore } from "../store/create-store.js"
import type { TimelineConfig } from "../types.js"
import { TimelineMutationCoordinator } from "../utils/mutation-coordinator.js"
import {
  validateTimelineDependencies,
  validateTimelineItems,
} from "../utils/data-validation.js"

export interface TimelineProviderProps {
  /** Consumer-facing configuration */
  config: TimelineConfig
  children: ReactNode
}

/**
 * Provider component that creates and manages a timeline store instance.
 *
 * The store is created once on mount and reused across re-renders.
 * Config (renderers/callbacks) is provided via a separate context
 * so it can update without recreating the store.
 */
export function TimelineProvider({ config, children }: TimelineProviderProps) {
  const {
    dependenciesList,
    items: controlledItems,
    onDataValidationError,
  } = config
  const [store] = useState(() =>
    createTimelineStore({
      items: config.items,
      viewportMode: config.viewportMode,
      readOnly: config.readOnly,
      sidebar: config.sidebar,
      subItems: config.subItems,
      rowSubItems: config.rowSubItems,
      sidebarSubItems: config.sidebarSubItems,
      dependencies: config.dependencies,
      snapToGrid: config.snapToGrid,
      rowHeight: config.rowHeight,
    })
  )
  const [mutationCoordinator] = useState(
    () => new TimelineMutationCoordinator(store, config)
  )
  const previousItems = useRef(config.items)
  const previousDataVersion = useRef(config.dataVersion)

  useLayoutEffect(() => {
    mutationCoordinator.updateConfig(config)
  }, [config, mutationCoordinator])

  useEffect(() => {
    if (!onDataValidationError) return
    const issues = [
      ...validateTimelineItems(controlledItems),
      ...validateTimelineDependencies(dependenciesList ?? [], controlledItems),
    ]
    if (issues.length > 0) onDataValidationError(issues)
  }, [controlledItems, dependenciesList, onDataValidationError])

  // Keep controlled configuration in sync without recreating the per-instance
  // store. Store actions remain stable and each effect only touches its own
  // narrow slice.
  useEffect(() => {
    if (
      previousItems.current === config.items &&
      previousDataVersion.current === config.dataVersion
    )
      return
    previousItems.current = config.items
    previousDataVersion.current = config.dataVersion
    mutationCoordinator.syncExternalItems(config.items)
  }, [config.items, config.dataVersion, mutationCoordinator])

  useEffect(
    () => () => {
      mutationCoordinator.cancelPending("Timeline provider unmounted")
      mutationCoordinator.dispose()
    },
    [mutationCoordinator]
  )

  useEffect(() => {
    store.getState().actions.setReadOnly(config.readOnly ?? false)
  }, [config.readOnly, store])

  useEffect(() => {
    store.getState().actions.setSidebarVisible(config.sidebar ?? false)
  }, [config.sidebar, store])

  useEffect(() => {
    store
      .getState()
      .actions.setRowSubItemMode(
        config.rowSubItems ?? config.subItems ?? "disabled"
      )
  }, [config.rowSubItems, config.subItems, store])

  useEffect(() => {
    store
      .getState()
      .actions.setSidebarSubItemMode(
        config.sidebarSubItems ?? config.subItems ?? "disabled"
      )
  }, [config.sidebarSubItems, config.subItems, store])

  useEffect(() => {
    store
      .getState()
      .actions.setDependenciesEnabled(config.dependencies ?? false)
  }, [config.dependencies, store])

  useEffect(() => {
    store.getState().actions.setSnapToGrid(config.snapToGrid ?? true)
  }, [config.snapToGrid, store])

  useEffect(() => {
    if (config.rowHeight === undefined) return
    store.getState().actions.setRowHeight(config.rowHeight)
  }, [config.rowHeight, store])

  useEffect(() => {
    if (config.viewportMode === undefined) return
    store.getState().actions.setViewportMode(config.viewportMode)
  }, [config.viewportMode, store])

  return (
    <TimelineConfigContext.Provider value={config}>
      <TimelineMutationContext.Provider value={mutationCoordinator}>
        <TimelineContext.Provider value={store}>
          {children}
        </TimelineContext.Provider>
      </TimelineMutationContext.Provider>
    </TimelineConfigContext.Provider>
  )
}
