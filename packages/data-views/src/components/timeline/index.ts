"use client"

/**
 * Export public interfaces for the timeline component.
 */
// Core
export { TimelineProvider } from "./context/timeline-provider.js"
export type { TimelineProviderProps } from "./context/timeline-provider.js"
export { Timeline } from "./components/timeline.js"
export type { TimelineProps } from "./components/timeline.js"
export { TimelineSurface } from "./components/timeline-surface.js"
export type { TimelineSurfaceProps } from "./components/timeline-surface.js"
export { TimelineControls } from "./components/timeline-controls.js"
export { TimelineSettings } from "./components/timeline-settings.js"
export { TimelineViewportSelect } from "./components/timeline-viewport-select.js"
export { VIEWPORT_MODES_ORDERED } from "./constants.js"
export { useTimelineStore } from "./hooks/use-timeline-store.js"
export { useTimelineMutations } from "./context/timeline-mutation-context.js"
export * from "./types.js"
export * from "./production-types.js"

// Interaction hooks
export { useDrag } from "./hooks/use-drag.js"
export { useResize } from "./hooks/use-resize.js"
export { useMultiSelect } from "./hooks/use-multi-select.js"
export { useAutoScroll } from "./hooks/use-auto-scroll.js"
export { useShiftScroll } from "./hooks/use-shift-scroll.js"
export { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts.js"

// Interaction component
export { TimelineGhostBar } from "./components/timeline-ghost-bar.js"

// Sidebar and sub-items
export { TimelineSidebar } from "./components/timeline-sidebar.js"
export { TimelineSidebarItem } from "./components/timeline-sidebar-item.js"
export { useDisplayRows } from "./hooks/use-display-rows.js"
export type { DisplayRow } from "./hooks/use-display-rows.js"

// Dependencies and offscreen navigation
export { TimelineDependencyLayer } from "./components/timeline-dependency-layer.js"
export { TimelineHierarchyLayer } from "./components/timeline-hierarchy-layer.js"
export { TimelineOffscreenIndicator } from "./components/timeline-offscreen-indicator.js"
export { useOffscreenItems } from "./hooks/use-offscreen-items.js"
export * from "./utils/dependency-path.js"

// Virtualization and empty state
export {
  computeVirtualRowRange,
  useVirtualRows,
} from "./hooks/use-virtual-rows.js"
export { TimelineEmptyState } from "./components/timeline-empty-state.js"
export {
  canAddTimelineDependency,
  validateTimelineDependencies,
  validateTimelineItems,
} from "./utils/data-validation.js"
