/**
 * Core type definitions for the Timeline component.
 *
 * Covers data models, viewport modes, store state shapes,
 * drag/interaction state, and consumer-facing configuration.
 */
import type { ReactNode } from "react"
import type { TimelineProductionConfig } from "./production-types.js"

// ── Data Models ──────────────────────────────────────────────────────────────

/** A single item on the timeline */
export interface TimelineItem {
  /** Unique identifier */
  readonly id: string
  /** Start date of the item */
  startDate: Date
  /** End date of the item */
  endDate: Date
  /** Parent item ID — used for sub-item grouping */
  parentId?: string
  /** Consumer's arbitrary data payload */
  data: unknown
}

/** A dependency between two items */
export interface TimelineDependency {
  /** Unique identifier */
  readonly id: string
  /** Source item ID */
  readonly fromItemId: string
  /** Target item ID */
  readonly toItemId: string
  /** Dependency type */
  readonly type: "finish-to-start"
}

// ── Enums / Unions ───────────────────────────────────────────────────────────

/** Available viewport zoom levels */
export type ViewportMode =
  "hours" | "day" | "week" | "bi-week" | "month" | "quarter" | "year"

/** Sub-item rendering modes */
export type SubItemMode = "disabled" | "flattened" | "nested"

// ── Store State Types ────────────────────────────────────────────────────────

/** Drag operation state */
export type DragState = {
  /** What kind of drag is in progress */
  type: "move" | "resize-left" | "resize-right"
  /** IDs of all items being dragged (supports multi-select drag) */
  itemIds: string[]
  /** Pointer X at drag start */
  originX: number
  /** Current pointer X */
  currentX: number
  /** Scroll offset at drag start */
  originScrollLeft: number
}

/** Info about the currently hovered cell in the grid */
export type HoveredCell = {
  /** Row index of the hovered cell */
  rowIndex: number
  /** Date at the hovered position */
  date: Date
}

/** Ghost bar state shown while hovering to add an item */
export type GhostBarState = {
  /** Row index where the ghost bar would be added */
  rowIndex: number
  /** Start date of the ghost bar */
  startDate: Date
  /** End date of the ghost bar */
  endDate: Date
}

/** Date range projected onto the header during row hover or resize. */
export type TimelineRangeHighlight =
  | {
      type: "row"
      itemId: string
      startDate: Date
      endDate: Date
    }
  | {
      type: "drag"
      itemId: string
      startDate: Date
      endDate: Date
    }
  | {
      type: "resize"
      itemId: string
      startDate: Date
      endDate: Date
      activeEdge: "start" | "end"
    }

// ── Store Slice Interfaces ───────────────────────────────────────────────────

/** Viewport slice — scroll position, dimensions, and zoom level */
export interface ViewportSlice {
  viewportMode: ViewportMode
  timelineOrigin: Date
  timelineEnd: Date
  scrollLeft: number // The number of pixels that are currently hidden to the left of your screen.
  scrollTop: number //The number of pixels hidden above your screen
  viewportWidth: number
  viewportHeight: number
  actions: {
    setViewportMode: (mode: ViewportMode) => void
    scrollTo: (x: number, y?: number) => void
    scrollToDate: (date: Date) => void
    scrollToToday: () => void
    scrollToItem: (itemId: string) => void
    setTimelineRange: (origin: Date, end: Date, scrollLeft?: number) => void
    setViewportDimensions: (width: number, height: number) => void
  }
}

/** Items slice — item data, ordering, and undo/redo */
export interface ItemsSlice {
  items: Map<string, TimelineItem>
  itemOrder: string[]
  undoStack: Array<{ items: Map<string, TimelineItem>; itemOrder: string[] }>
  redoStack: Array<{ items: Map<string, TimelineItem>; itemOrder: string[] }>
  actions: {
    /** Replace the controlled render projection without creating undo history. */
    syncItems: (items: TimelineItem[]) => void
    setItems: (items: TimelineItem[]) => void
    updateItem: (id: string, partial: Partial<TimelineItem>) => void
    addItem: (item: TimelineItem) => void
    removeItems: (ids: string[]) => void
    undo: () => void
    redo: () => void
  }
}

/** Interaction slice — drag, hover, and ghost bar state */
export interface InteractionSlice {
  dragState: DragState | null
  hoveredCell: HoveredCell | null
  ghostBar: GhostBarState | null
  rangeHighlight: TimelineRangeHighlight | null
  activeDependencyPortId: string | null
  actions: {
    startDrag: (drag: DragState) => void
    updateDrag: (currentX: number) => void
    endDrag: () => void
    setHoveredCell: (cell: HoveredCell) => void
    clearHoveredCell: () => void
    setGhostBar: (ghost: GhostBarState) => void
    clearGhostBar: () => void
    setRangeHighlight: (highlight: TimelineRangeHighlight) => void
    clearRangeHighlight: () => void
    setActiveDependencyPort: (id: string) => void
    clearActiveDependencyPort: () => void
  }
}

/** Selection slice — selected item tracking */
export interface SelectionSlice {
  selectedIds: Set<string>
  actions: {
    select: (id: string, mode: "replace" | "toggle" | "range") => void
    selectAll: () => void
    clearSelection: () => void
    deleteSelected: () => void
    duplicateSelected: () => void
  }
}

/** UI slice — visual/behavior configuration */
export interface UISlice {
  readOnly: boolean
  sidebarVisible: boolean
  sidebarWidth: number
  sidebarResizing: boolean
  searchQuery: string
  rowSubItemMode: SubItemMode
  sidebarSubItemMode: SubItemMode
  dependenciesEnabled: boolean
  snapToGrid: boolean
  rowHeight: number
  rowExpandedGroups: Set<string>
  sidebarExpandedGroups: Set<string>
  actions: {
    toggleRowGroup: (parentId: string) => void
    toggleSidebarGroup: (parentId: string) => void
    setSidebarWidth: (width: number) => void
    setSidebarResizing: (resizing: boolean) => void
    setSearchQuery: (query: string) => void
    setReadOnly: (readOnly: boolean) => void
    setSidebarVisible: (visible: boolean) => void
    setRowSubItemMode: (mode: SubItemMode) => void
    setSidebarSubItemMode: (mode: SubItemMode) => void
    setDependenciesEnabled: (enabled: boolean) => void
    setSnapToGrid: (snap: boolean) => void
    setRowHeight: (height: number) => void
  }
}

/** Complete store state — union of all slices */
export type TimelineState = ViewportSlice &
  ItemsSlice &
  InteractionSlice &
  SelectionSlice &
  UISlice

// ── Consumer-Facing Config ───────────────────────────────────────────────────

/** Consumer-facing config props for the Timeline component */
export interface TimelineConfig extends TimelineProductionConfig {
  // Data
  items: TimelineItem[]
  dependenciesList?: TimelineDependency[]

  // Renderers (the consumer owns all visual content)
  renderBar: (
    item: TimelineItem,
    state: { isDragging: boolean; isSelected: boolean }
  ) => ReactNode
  renderSidebarItem?: (
    item: TimelineItem,
    state: { isExpanded: boolean }
  ) => ReactNode
  renderTooltip?: (item: TimelineItem) => ReactNode
  renderEmptyState?: () => ReactNode
  /** Text used by the built-in row search. Defaults to item id + primitive data values. */
  getSearchText?: (item: TimelineItem) => string

  // Options
  viewportMode?: ViewportMode
  readOnly?: boolean
  sidebar?: boolean
  /** Hierarchy mode for bars in the timeline grid. */
  rowSubItems?: SubItemMode
  /** Hierarchy mode for labels in the sidebar. */
  sidebarSubItems?: SubItemMode
  /**
   * Backwards-compatible shorthand used for both surfaces when their
   * dedicated option is omitted.
   */
  subItems?: SubItemMode
  dependencies?: boolean
  snapToGrid?: boolean
  rowHeight?: number

  // Callbacks
  onItemsChange?: (items: TimelineItem[]) => void
  onItemAdd?: (startDate: Date, endDate: Date, rowIndex: number) => void
  onItemClick?: (item: TimelineItem) => void
  onItemDoubleClick?: (item: TimelineItem) => void
  onItemsDelete?: (ids: string[]) => void
  onDependencyAdd?: (dependency: TimelineDependency) => void
  onDependencyRemove?: (dependency: TimelineDependency) => void
  onViewportModeChange?: (mode: ViewportMode) => void
  onSidebarVisibleChange?: (visible: boolean) => void
  onDependenciesEnabledChange?: (enabled: boolean) => void
  onSnapToGridChange?: (enabled: boolean) => void
  onRowSubItemModeChange?: (mode: SubItemMode) => void
  onSidebarSubItemModeChange?: (mode: SubItemMode) => void
}
