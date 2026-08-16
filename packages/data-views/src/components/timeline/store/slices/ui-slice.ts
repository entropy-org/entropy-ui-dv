/**
 * UI slice — manages visual/behavioral configuration state.
 *
 * Tracks read-only mode, sidebar visibility/width, sub-item mode,
 * dependency visibility, snap-to-grid, row height, and expanded groups
 * for nested sub-items.
 */
import type { StateCreator } from "zustand"
import type { SubItemMode, TimelineState } from "../../types.js"
import {
  DEFAULT_ROW_HEIGHT,
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
} from "../../constants.js"

/** Create the UI slice */
export const createUISlice: StateCreator<
  TimelineState,
  [],
  [],
  Pick<
    TimelineState,
    | "readOnly"
    | "sidebarVisible"
    | "sidebarWidth"
    | "sidebarResizing"
    | "searchQuery"
    | "rowSubItemMode"
    | "sidebarSubItemMode"
    | "dependenciesEnabled"
    | "snapToGrid"
    | "rowHeight"
    | "rowExpandedGroups"
    | "sidebarExpandedGroups"
    | "actions"
  >
> = (set, get) => ({
  readOnly: false,
  sidebarVisible: false,
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  sidebarResizing: false,
  searchQuery: "",
  rowSubItemMode: "disabled" as SubItemMode,
  sidebarSubItemMode: "disabled" as SubItemMode,
  dependenciesEnabled: false,
  snapToGrid: true,
  rowHeight: DEFAULT_ROW_HEIGHT,
  rowExpandedGroups: new Set<string>(),
  sidebarExpandedGroups: new Set<string>(),

  actions: {
    toggleRowGroup: (parentId: string) => {
      const next = new Set(get().rowExpandedGroups)
      if (next.has(parentId)) {
        next.delete(parentId)
      } else {
        next.add(parentId)
      }
      set({ rowExpandedGroups: next })
    },

    toggleSidebarGroup: (parentId: string) => {
      const next = new Set(get().sidebarExpandedGroups)
      if (next.has(parentId)) {
        next.delete(parentId)
      } else {
        next.add(parentId)
      }
      set({ sidebarExpandedGroups: next })
    },

    setSidebarWidth: (width: number) => {
      set({
        sidebarWidth: Math.max(
          MIN_SIDEBAR_WIDTH,
          Math.min(MAX_SIDEBAR_WIDTH, width)
        ),
      })
    },

    setReadOnly: (readOnly: boolean) => {
      set({ readOnly })
    },

    setSidebarVisible: (visible: boolean) => {
      set({ sidebarVisible: visible })
    },

    setRowSubItemMode: (mode: SubItemMode) => {
      set({ rowSubItemMode: mode })
    },

    setSidebarResizing: (resizing: boolean) => {
      set({ sidebarResizing: resizing })
    },

    setSearchQuery: (query: string) => {
      set({ searchQuery: query, scrollTop: 0 })
    },

    setSidebarSubItemMode: (mode: SubItemMode) => {
      set({ sidebarSubItemMode: mode })
    },

    setDependenciesEnabled: (enabled: boolean) => {
      set({ dependenciesEnabled: enabled })
    },

    setSnapToGrid: (snap: boolean) => {
      set({ snapToGrid: snap })
    },

    setRowHeight: (height: number) => {
      set({ rowHeight: Math.max(24, height) })
    },
  } as TimelineState["actions"],
})
