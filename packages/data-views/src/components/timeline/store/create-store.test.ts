/**
 * Tests for the store factory — verifies independence of instances.
 */
import { describe, it, expect } from "vitest"
import { createTimelineStore } from "./create-store.js"
import { createTestItems } from "../test/fixtures.js"

describe("createTimelineStore", () => {
  it("creates a store with default state", () => {
    const store = createTimelineStore()
    const state = store.getState()

    expect(state.viewportMode).toBe("week")
    expect(state.scrollLeft).toBe(0)
    expect(state.scrollTop).toBe(0)
    expect(state.items.size).toBe(0)
    expect(state.itemOrder).toHaveLength(0)
    expect(state.selectedIds.size).toBe(0)
    expect(state.dragState).toBeNull()
    expect(state.readOnly).toBe(false)
    expect(state.sidebarVisible).toBe(false)
    expect(state.snapToGrid).toBe(true)
    expect(state.rowHeight).toBe(40)
    expect(state.rowSubItemMode).toBe("disabled")
    expect(state.sidebarSubItemMode).toBe("disabled")
    expect(state.dependenciesEnabled).toBe(false)
  })

  it("creates a store with initial items", () => {
    const items = createTestItems(3)
    const store = createTimelineStore({ items })
    const state = store.getState()

    expect(state.items.size).toBe(3)
    expect(state.itemOrder).toEqual(["item-1", "item-2", "item-3"])
  })

  it("accepts initial config options", () => {
    const store = createTimelineStore({
      viewportMode: "month",
      readOnly: true,
      sidebar: true,
      snapToGrid: false,
      rowHeight: 48,
      subItems: "nested",
      dependencies: true,
    })
    const state = store.getState()

    expect(state.viewportMode).toBe("month")
    expect(state.readOnly).toBe(true)
    expect(state.sidebarVisible).toBe(true)
    expect(state.snapToGrid).toBe(false)
    expect(state.rowHeight).toBe(48)
    expect(state.rowSubItemMode).toBe("nested")
    expect(state.sidebarSubItemMode).toBe("nested")
    expect(state.dependenciesEnabled).toBe(true)
  })

  it("produces fully independent instances", () => {
    const store1 = createTimelineStore()
    const store2 = createTimelineStore()

    // Mutate store1
    store1.getState().actions.setViewportMode("day")
    store1.getState().actions.addItem({
      id: "test",
      startDate: new Date(),
      endDate: new Date(),
      data: null,
    })
    store1.getState().actions.select("test", "replace")

    // store2 should be unaffected
    const state2 = store2.getState()
    expect(state2.viewportMode).toBe("week")
    expect(state2.items.size).toBe(0)
    expect(state2.selectedIds.size).toBe(0)
  })

  it("produces independent instances — mutating one never affects the other", () => {
    const items = createTestItems(2)
    const store1 = createTimelineStore({ items })
    const store2 = createTimelineStore({ items })

    // Remove items from store1
    store1.getState().actions.removeItems(["item-1"])
    expect(store1.getState().items.size).toBe(1)

    // store2 retains both
    expect(store2.getState().items.size).toBe(2)
    expect(store2.getState().itemOrder).toEqual(["item-1", "item-2"])
  })
})
