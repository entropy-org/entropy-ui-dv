import { describe, expect, it } from "vitest"
import { createCalendarStore } from "./create-store.js"
import { TEST_ANCHOR_DATE } from "../test/fixtures.js"

function createStore() {
  return createCalendarStore({ initialAnchorDate: TEST_ANCHOR_DATE })
}

describe("createCalendarStore", () => {
  it("composes client-only slice defaults under one stable actions object", () => {
    const store = createStore()
    const state = store.getState()

    expect(state.anchorDate).toBe(TEST_ANCHOR_DATE)
    expect(state.focusedDate).toBeNull()
    expect(state.selectedIds.size).toBe(0)
    expect(state.interaction).toEqual({ type: "idle" })
    expect(state.undoStack).toEqual([])
    expect(state.redoStack).toEqual([])
    expect(state.pendingCommands).toEqual([])
    expect(state.searchQuery).toBe("")
    expect(state.settingsOpen).toBe(false)
    expect(state.overflow).toEqual({ type: "closed" })
    expect(state).not.toHaveProperty("items")
    expect(state).not.toHaveProperty("preferences")

    const actions = state.actions
    actions.setSearchQuery("launch")
    expect(store.getState().actions).toBe(actions)
  })

  it("creates fully isolated store instances", () => {
    const first = createStore()
    const second = createStore()

    first.getState().actions.setAnchorDate("2026-08-03")
    first.getState().actions.replaceSelection(["item-1"], "item-1")
    first.getState().actions.setSearchQuery("launch")
    first.getState().actions.setSettingsOpen(true)

    expect(second.getState().anchorDate).toBe(TEST_ANCHOR_DATE)
    expect(second.getState().selectedIds.size).toBe(0)
    expect(second.getState().searchQuery).toBe("")
    expect(second.getState().settingsOpen).toBe(false)
  })
})
