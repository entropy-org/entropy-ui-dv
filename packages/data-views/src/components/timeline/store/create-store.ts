/**
 * Timeline store factory — creates independent store instances.
 *
 * Each `<TimelineProvider>` creates its own store via `createTimelineStore()`,
 * ensuring multiple timeline instances on the same page are fully isolated.
 */
import { createStore } from "zustand/vanilla"
import type {
  SubItemMode,
  TimelineItem,
  TimelineState,
  ViewportMode,
} from "../types.js"
import {
  DEFAULT_ROW_HEIGHT,
  DEFAULT_SIDEBAR_WIDTH,
  DEFAULT_VIEWPORT_MODE,
  MAX_UNDO_HISTORY,
} from "../constants.js"
import {
  dateToPx,
  getBarPosition,
  pxToDate,
} from "../utils/position-utils.js"
import { createTimelineCanvasRange } from "../utils/timeline-range.js"

/** Options for creating a timeline store */
export interface CreateTimelineStoreOptions {
  /** Initial items to populate */
  items?: TimelineItem[]
  /** Initial viewport mode */
  viewportMode?: ViewportMode
  /** Initial read-only state */
  readOnly?: boolean
  /** Initial sidebar visibility */
  sidebar?: boolean
  /** Initial sub-item mode */
  subItems?: SubItemMode
  /** Initial grid-row sub-item mode */
  rowSubItems?: SubItemMode
  /** Initial sidebar sub-item mode */
  sidebarSubItems?: SubItemMode
  /** Initial dependencies enabled */
  dependencies?: boolean
  /** Initial snap-to-grid */
  snapToGrid?: boolean
  /** Initial row height */
  rowHeight?: number
  /** Initial scrollLeft */
  scrollLeft?: number
  /** Initial scrollTop */
  scrollTop?: number
  /** Initial viewportWidth */
  viewportWidth?: number
  /** Initial viewportHeight */
  viewportHeight?: number
}

/**
 * Create a fully independent timeline store instance.
 *
 * @param options - Initial configuration
 * @returns A Zustand vanilla store
 */
export function createTimelineStore(options: CreateTimelineStoreOptions = {}) {
  const initialItems = new Map<string, TimelineItem>()
  const initialOrder: string[] = []

  if (options.items) {
    for (const item of options.items) {
      initialItems.set(item.id, item)
      initialOrder.push(item.id)
    }
  }

  const initialViewportMode = options.viewportMode ?? DEFAULT_VIEWPORT_MODE
  const initialTimelineRange = createTimelineCanvasRange(
    initialItems,
    initialViewportMode
  )

  return createStore<TimelineState>()((set, get) => {
    /**
     * Helper: push a snapshot of items state onto the undo stack.
     * Caps at 50 entries and clears the redo stack.
     */
    const pushUndo = () => {
      const state = get()
      const snapshot = {
        items: new Map(state.items),
        itemOrder: [...state.itemOrder],
      }
      const newStack = [...state.undoStack, snapshot]
      return {
        undoStack:
          newStack.length > MAX_UNDO_HISTORY
            ? newStack.slice(newStack.length - MAX_UNDO_HISTORY)
            : newStack,
        redoStack: [] as TimelineState["redoStack"],
      }
    }

    return {
      // ── Viewport Slice ───────────────────────────────────────────
      viewportMode: initialViewportMode,
      timelineOrigin: initialTimelineRange.origin,
      timelineEnd: initialTimelineRange.end,
      scrollLeft: options.scrollLeft ?? 0,
      scrollTop: options.scrollTop ?? 0,
      viewportWidth: options.viewportWidth ?? 0,
      viewportHeight: options.viewportHeight ?? 0,

      // ── Items Slice ──────────────────────────────────────────────
      items: initialItems,
      itemOrder: initialOrder,
      undoStack: [],
      redoStack: [],

      // ── Interaction Slice ────────────────────────────────────────
      dragState: null,
      hoveredCell: null,
      ghostBar: null,
      rangeHighlight: null,
      activeDependencyPortId: null,

      // ── Selection Slice ──────────────────────────────────────────
      selectedIds: new Set<string>(),

      // ── UI Slice ─────────────────────────────────────────────────
      readOnly: options.readOnly ?? false,
      sidebarVisible: options.sidebar ?? false,
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      sidebarResizing: false,
      searchQuery: "",
      rowSubItemMode: options.rowSubItems ?? options.subItems ?? "disabled",
      sidebarSubItemMode:
        options.sidebarSubItems ?? options.subItems ?? "disabled",
      dependenciesEnabled: options.dependencies ?? false,
      snapToGrid: options.snapToGrid ?? true,
      rowHeight: options.rowHeight ?? DEFAULT_ROW_HEIGHT,
      rowExpandedGroups: new Set<string>(),
      sidebarExpandedGroups: new Set<string>(),

      // ── Actions ──────────────────────────────────────────────────
      actions: {
        // Viewport actions
        setViewportMode: (mode: ViewportMode) => {
          const state = get()
          if (state.viewportMode === mode) return

          const centerDate = pxToDate(
            state.scrollLeft + state.viewportWidth / 2,
            state.timelineOrigin,
            state.viewportMode
          )
          const nextRange = createTimelineCanvasRange(state.items, mode)
          const nextCenter = dateToPx(centerDate, nextRange.origin, mode)

          set({
            viewportMode: mode,
            timelineOrigin: nextRange.origin,
            timelineEnd: nextRange.end,
            scrollLeft: Math.max(0, nextCenter - state.viewportWidth / 2),
          })
        },
        scrollTo: (x: number, y?: number) =>
          set({ scrollLeft: x, ...(y !== undefined ? { scrollTop: y } : {}) }),
        scrollToDate: (date: Date) => {
          const { viewportMode, viewportWidth, timelineOrigin } = get()
          const px = dateToPx(date, timelineOrigin, viewportMode)
          set({ scrollLeft: Math.max(0, px - viewportWidth / 2) })
        },
        scrollToToday: () => get().actions.scrollToDate(new Date()),
        scrollToItem: (itemId: string) => {
          const {
            items: storeItems,
            viewportMode,
            viewportWidth,
            timelineOrigin,
          } = get()
          const item = storeItems.get(itemId)
          if (!item) return
          const pos = getBarPosition(
            item.startDate,
            item.endDate,
            timelineOrigin,
            viewportMode
          )
          const center = pos.left + pos.width / 2
          set({ scrollLeft: Math.max(0, center - viewportWidth / 2) })
        },
        setTimelineRange: (origin: Date, end: Date, nextScrollLeft?: number) =>
          set({
            timelineOrigin: origin,
            timelineEnd: end,
            ...(nextScrollLeft === undefined
              ? {}
              : { scrollLeft: nextScrollLeft }),
          }),
        setViewportDimensions: (width: number, height: number) =>
          set({ viewportWidth: width, viewportHeight: height }),

        // Items actions
        syncItems: (items: TimelineItem[]) => {
          const state = get()
          const nextItems = new Map<string, TimelineItem>()
          const nextOrder: string[] = []
          for (const item of items) {
            if (nextItems.has(item.id)) continue
            nextItems.set(item.id, item)
            nextOrder.push(item.id)
          }
          const selectedIds = new Set(
            [...state.selectedIds].filter((id) => nextItems.has(id))
          )
          const dragState = state.dragState?.itemIds.every((id) =>
            nextItems.has(id)
          )
            ? state.dragState
            : null
          set({
            items: nextItems,
            itemOrder: nextOrder,
            selectedIds,
            dragState,
            rangeHighlight:
              state.rangeHighlight && nextItems.has(state.rangeHighlight.itemId)
                ? state.rangeHighlight
                : null,
            undoStack: [],
            redoStack: [],
          })
        },
        setItems: (items: TimelineItem[]) => {
          const undo = pushUndo()
          const newItems = new Map<string, TimelineItem>()
          const newOrder: string[] = []
          for (const item of items) {
            newItems.set(item.id, item)
            newOrder.push(item.id)
          }
          set({ items: newItems, itemOrder: newOrder, ...undo })
        },
        addItem: (item: TimelineItem) => {
          const undo = pushUndo()
          const state = get()
          const newItems = new Map(state.items)
          newItems.set(item.id, item)
          set({
            items: newItems,
            itemOrder: [...state.itemOrder, item.id],
            ...undo,
          })
        },
        updateItem: (id: string, partial: Partial<TimelineItem>) => {
          const state = get()
          const existing = state.items.get(id)
          if (!existing) return
          const undo = pushUndo()
          const newItems = new Map(state.items)
          newItems.set(id, { ...existing, ...partial })
          set({ items: newItems, ...undo })
        },
        removeItems: (ids: string[]) => {
          const undo = pushUndo()
          const state = get()
          const idSet = new Set(ids)
          const newItems = new Map(state.items)
          for (const id of ids) newItems.delete(id)
          set({
            items: newItems,
            itemOrder: state.itemOrder.filter((id) => !idSet.has(id)),
            ...undo,
          })
        },
        undo: () => {
          const state = get()
          if (state.undoStack.length === 0) return
          const snapshot = {
            items: new Map(state.items),
            itemOrder: [...state.itemOrder],
          }
          const prev = state.undoStack[state.undoStack.length - 1]
          set({
            items: new Map(prev.items),
            itemOrder: [...prev.itemOrder],
            undoStack: state.undoStack.slice(0, -1),
            redoStack: [...state.redoStack, snapshot],
          })
        },
        redo: () => {
          const state = get()
          if (state.redoStack.length === 0) return
          const snapshot = {
            items: new Map(state.items),
            itemOrder: [...state.itemOrder],
          }
          const next = state.redoStack[state.redoStack.length - 1]
          set({
            items: new Map(next.items),
            itemOrder: [...next.itemOrder],
            undoStack: [...state.undoStack, snapshot],
            redoStack: state.redoStack.slice(0, -1),
          })
        },

        // Interaction actions
        startDrag: (drag) => set({ dragState: drag }),
        updateDrag: (currentX: number) => {
          const { dragState } = get()
          if (!dragState) return
          set({ dragState: { ...dragState, currentX } })
        },
        endDrag: () => set({ dragState: null }),
        setHoveredCell: (cell) => set({ hoveredCell: cell }),
        clearHoveredCell: () => set({ hoveredCell: null }),
        setGhostBar: (ghost) => set({ ghostBar: ghost }),
        clearGhostBar: () => set({ ghostBar: null }),
        setRangeHighlight: (highlight) => {
          const current = get().rangeHighlight
          const unchanged =
            current?.type === highlight.type &&
            current.itemId === highlight.itemId &&
            current.startDate.getTime() === highlight.startDate.getTime() &&
            current.endDate.getTime() === highlight.endDate.getTime() &&
            (current.type !== "resize" ||
              (highlight.type === "resize" &&
                current.activeEdge === highlight.activeEdge))
          if (!unchanged) set({ rangeHighlight: highlight })
        },
        clearRangeHighlight: () => set({ rangeHighlight: null }),
        setActiveDependencyPort: (id: string) =>
          set({ activeDependencyPortId: id }),
        clearActiveDependencyPort: () => set({ activeDependencyPortId: null }),

        // Selection actions
        select: (id, mode) => {
          const state = get()
          switch (mode) {
            case "replace":
              set({ selectedIds: new Set([id]) })
              break
            case "toggle": {
              const next = new Set(state.selectedIds)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              set({ selectedIds: next })
              break
            }
            case "range": {
              const { itemOrder: order } = state
              const targetIdx = order.indexOf(id)
              if (targetIdx === -1) break
              let anchorIdx = -1
              for (let i = order.length - 1; i >= 0; i--) {
                if (state.selectedIds.has(order[i])) {
                  anchorIdx = i
                  break
                }
              }
              if (anchorIdx === -1) {
                set({ selectedIds: new Set([id]) })
                break
              }
              const start = Math.min(anchorIdx, targetIdx)
              const end = Math.max(anchorIdx, targetIdx)
              const next = new Set(state.selectedIds)
              for (let i = start; i <= end; i++) next.add(order[i])
              set({ selectedIds: next })
              break
            }
          }
        },
        selectAll: () => set({ selectedIds: new Set(get().itemOrder) }),
        clearSelection: () => set({ selectedIds: new Set<string>() }),
        deleteSelected: () => {
          const state = get()
          if (state.selectedIds.size === 0) return
          state.actions.removeItems([...state.selectedIds])
          set({ selectedIds: new Set<string>() })
        },
        duplicateSelected: () => {
          const state = get()
          if (state.selectedIds.size === 0) return
          const undo = pushUndo()
          const now = Date.now()
          const newItems = new Map(state.items)
          const newOrder = [...state.itemOrder]
          const newIds: string[] = []
          for (const id of state.selectedIds) {
            const original = state.items.get(id)
            if (!original) continue
            const duration =
              original.endDate.getTime() - original.startDate.getTime()
            const newId = `${id}-copy-${now}`
            const clone: TimelineItem = {
              ...original,
              id: newId,
              startDate: new Date(original.endDate.getTime()),
              endDate: new Date(original.endDate.getTime() + duration),
            }
            newItems.set(newId, clone)
            newOrder.push(newId)
            newIds.push(newId)
          }
          set({
            items: newItems,
            itemOrder: newOrder,
            selectedIds: new Set(newIds),
            ...undo,
          })
        },

        // UI actions
        toggleRowGroup: (parentId: string) => {
          const next = new Set(get().rowExpandedGroups)
          if (next.has(parentId)) next.delete(parentId)
          else next.add(parentId)
          set({ rowExpandedGroups: next })
        },
        toggleSidebarGroup: (parentId: string) => {
          const next = new Set(get().sidebarExpandedGroups)
          if (next.has(parentId)) next.delete(parentId)
          else next.add(parentId)
          set({ sidebarExpandedGroups: next })
        },
        setSidebarWidth: (width: number) =>
          set({ sidebarWidth: Math.max(120, Math.min(500, width)) }),
        setSidebarResizing: (resizing: boolean) =>
          set({ sidebarResizing: resizing }),
        setSearchQuery: (query: string) =>
          set({ searchQuery: query, scrollTop: 0 }),
        setReadOnly: (readOnly: boolean) => set({ readOnly }),
        setSidebarVisible: (visible: boolean) =>
          set({ sidebarVisible: visible }),
        setRowSubItemMode: (mode) => set({ rowSubItemMode: mode }),
        setSidebarSubItemMode: (mode) => set({ sidebarSubItemMode: mode }),
        setDependenciesEnabled: (enabled: boolean) =>
          set({ dependenciesEnabled: enabled }),
        setSnapToGrid: (snap: boolean) => set({ snapToGrid: snap }),
        setRowHeight: (height: number) =>
          set({ rowHeight: Math.max(24, height) }),
      },
    }
  })
}

/** Type of a store created by `createTimelineStore` */
export type TimelineStore = ReturnType<typeof createTimelineStore>
