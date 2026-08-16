/**
 * Tests for the UI slice — configuration state and toggles.
 */
import { describe, expect, it } from "vitest"
import { createTimelineStore } from "../create-store.js"

describe("ui slice", () => {
  describe("initial state", () => {
    it("has expected defaults", () => {
      const store = createTimelineStore()
      const state = store.getState()

      expect(state.readOnly).toBe(false)
      expect(state.sidebarVisible).toBe(false)
      expect(state.sidebarWidth).toBe(240)
      expect(state.searchQuery).toBe("")
      expect(state.rowSubItemMode).toBe("disabled")
      expect(state.sidebarSubItemMode).toBe("disabled")
      expect(state.dependenciesEnabled).toBe(false)
      expect(state.snapToGrid).toBe(true)
      expect(state.rowHeight).toBe(40)
      expect(state.rowExpandedGroups.size).toBe(0)
      expect(state.sidebarExpandedGroups.size).toBe(0)
    })
  })

  describe("setReadOnly", () => {
    it("toggles readOnly state", () => {
      const store = createTimelineStore()
      store.getState().actions.setReadOnly(true)
      expect(store.getState().readOnly).toBe(true)
      store.getState().actions.setReadOnly(false)
      expect(store.getState().readOnly).toBe(false)
    })
  })

  describe("setSidebarVisible", () => {
    it("toggles sidebar visibility", () => {
      const store = createTimelineStore()
      store.getState().actions.setSidebarVisible(true)
      expect(store.getState().sidebarVisible).toBe(true)
    })
  })

  describe("setSidebarWidth", () => {
    it("updates width within bounds", () => {
      const store = createTimelineStore()

      store.getState().actions.setSidebarWidth(300)
      expect(store.getState().sidebarWidth).toBe(300)

      // Clamps to min (120)
      store.getState().actions.setSidebarWidth(50)
      expect(store.getState().sidebarWidth).toBe(120)

      // Clamps to max (500)
      store.getState().actions.setSidebarWidth(600)
      expect(store.getState().sidebarWidth).toBe(500)
    })
  })

  describe("setSearchQuery", () => {
    it("updates the row filter and returns to the first result", () => {
      const store = createTimelineStore({ scrollTop: 240 })

      store.getState().actions.setSearchQuery("architecture")

      expect(store.getState().searchQuery).toBe("architecture")
      expect(store.getState().scrollTop).toBe(0)
    })
  })

  describe("independent sub-item modes", () => {
    it("updates the grid and sidebar modes independently", () => {
      const store = createTimelineStore()

      store.getState().actions.setRowSubItemMode("flattened")
      expect(store.getState().rowSubItemMode).toBe("flattened")
      expect(store.getState().sidebarSubItemMode).toBe("disabled")

      store.getState().actions.setSidebarSubItemMode("nested")
      expect(store.getState().sidebarSubItemMode).toBe("nested")
      expect(store.getState().rowSubItemMode).toBe("flattened")
    })
  })

  describe("setDependenciesEnabled", () => {
    it("toggles dependency visibility", () => {
      const store = createTimelineStore()
      store.getState().actions.setDependenciesEnabled(true)
      expect(store.getState().dependenciesEnabled).toBe(true)
    })
  })

  describe("setSnapToGrid", () => {
    it("toggles grid snapping", () => {
      const store = createTimelineStore()
      store.getState().actions.setSnapToGrid(false)
      expect(store.getState().snapToGrid).toBe(false)
    })
  })

  describe("setRowHeight", () => {
    it("updates row height with a minimum floor", () => {
      const store = createTimelineStore()

      store.getState().actions.setRowHeight(50)
      expect(store.getState().rowHeight).toBe(50)

      // Enforces minimum
      store.getState().actions.setRowHeight(10)
      expect(store.getState().rowHeight).toBe(24)
    })
  })

  describe("independent group expansion", () => {
    it("keeps row and sidebar expansion sets separate", () => {
      const store = createTimelineStore()

      store.getState().actions.toggleRowGroup("group-1")
      expect(store.getState().rowExpandedGroups).toEqual(new Set(["group-1"]))
      expect(store.getState().sidebarExpandedGroups).toEqual(new Set())

      store.getState().actions.toggleSidebarGroup("group-2")
      expect(store.getState().sidebarExpandedGroups).toEqual(
        new Set(["group-2"])
      )
      expect(store.getState().rowExpandedGroups).toEqual(new Set(["group-1"]))

      store.getState().actions.toggleRowGroup("group-1")
      expect(store.getState().rowExpandedGroups).toEqual(new Set())
    })
  })
})
