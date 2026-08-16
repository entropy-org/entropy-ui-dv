/**
 * Memoized derived selectors for the timeline store.
 *
 * These selectors compute derived values from store state.
 * Use with `useTimelineStore(selector)` to avoid unnecessary re-renders.
 */
import type {
  TimelineItem,
  TimelineState,
} from "../types.js"

/**
 * Select the current viewport mode.
 */
export const selectViewportMode = (state: TimelineState) => state.viewportMode

/**
 * Select scroll position as a tuple.
 */
export const selectScrollPosition = (state: TimelineState) => ({
  scrollLeft: state.scrollLeft,
  scrollTop: state.scrollTop,
})

/**
 * Select viewport dimensions.
 */
export const selectViewportDimensions = (state: TimelineState) => ({
  width: state.viewportWidth,
  height: state.viewportHeight,
})

/**
 * Select items as an ordered array.
 */
export const selectOrderedItems = (state: TimelineState): TimelineItem[] =>
  state.itemOrder
    .map((id) => state.items.get(id))
    .filter((item): item is TimelineItem => item !== undefined)

/**
 * Select a single item by ID.
 */
export const selectItemById =
  (id: string) =>
  (state: TimelineState): TimelineItem | undefined =>
    state.items.get(id)

/**
 * Select whether an item is selected.
 */
export const selectIsSelected =
  (id: string) =>
  (state: TimelineState): boolean =>
    state.selectedIds.has(id)

/**
 * Select the selected item count.
 */
export const selectSelectedCount = (state: TimelineState): number =>
  state.selectedIds.size

/**
 * Select drag state.
 */
export const selectDragState = (state: TimelineState) => state.dragState

/**
 * Select whether an item is currently being dragged.
 */
export const selectIsDragging =
  (id: string) =>
  (state: TimelineState): boolean =>
    state.dragState?.itemIds.includes(id) ?? false

/**
 * Select the actions object.
 */
export const selectActions = (state: TimelineState) => state.actions

/**
 * Select whether the timeline is in read-only mode.
 */
export const selectReadOnly = (state: TimelineState) => state.readOnly

/**
 * Select sidebar configuration.
 */
export const selectSidebar = (state: TimelineState) => ({
  visible: state.sidebarVisible,
  width: state.sidebarWidth,
})

/**
 * Select whether undo is available.
 */
export const selectCanUndo = (state: TimelineState): boolean =>
  state.undoStack.length > 0

/**
 * Select whether redo is available.
 */
export const selectCanRedo = (state: TimelineState): boolean =>
  state.redoStack.length > 0
