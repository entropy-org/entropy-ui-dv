import { describe, expect, it } from "vitest"
import { createCalendarStore } from "../create-store.js"
import {
  createMoveCommand,
  TEST_ANCHOR_DATE,
} from "../../test/fixtures.js"

function createStore() {
  return createCalendarStore({ initialAnchorDate: TEST_ANCHOR_DATE })
}

describe("calendar selection slice", () => {
  it("replaces, toggles, and selects a deterministic visible range", () => {
    const store = createStore()
    const { actions } = store.getState()

    actions.replaceSelection(["a", "b", "b"], "b")
    expect([...store.getState().selectedIds]).toEqual(["a", "b"])
    actions.selectRange("d", ["a", "b", "c", "d"])
    expect([...store.getState().selectedIds]).toEqual(["b", "c", "d"])

    actions.toggleSelection("c")
    expect([...store.getState().selectedIds]).toEqual(["b", "d"])
    expect(store.getState().selectionAnchorId).toBe("c")
    actions.selectRange("a", ["a", "b", "c", "d"])
    expect([...store.getState().selectedIds]).toEqual(["a", "b", "c"])
  })

  it("falls back to replacement when range selection has no valid anchor", () => {
    const store = createStore()
    const { actions } = store.getState()
    actions.selectRange("b", ["a", "b", "c"])
    expect([...store.getState().selectedIds]).toEqual(["b"])
    expect(store.getState().selectionAnchorId).toBe("b")

    const before = store.getState()
    actions.selectRange("missing", ["a", "b", "c"])
    expect(store.getState()).toBe(before)
    actions.clearSelection()
    expect(store.getState().selectedIds.size).toBe(0)
  })

  it("uses the last replacement ID as the default range anchor", () => {
    const store = createStore()
    const { actions } = store.getState()
    actions.replaceSelection(["a", "b"])
    expect(store.getState().selectionAnchorId).toBe("b")
    actions.selectRange("d", ["a", "b", "c", "d"])
    expect([...store.getState().selectedIds]).toEqual(["b", "c", "d"])
  })

  it("selects visible IDs and prunes filtered or removed IDs", () => {
    const store = createStore()
    const { actions } = store.getState()

    actions.selectVisible(["c", "a", "c", "b"])
    expect([...store.getState().selectedIds]).toEqual(["c", "a", "b"])
    expect(store.getState().selectionAnchorId).toBe("c")

    actions.pruneSelection(new Set(["a", "b"]))
    expect([...store.getState().selectedIds]).toEqual(["a", "b"])
    expect(store.getState().selectionAnchorId).toBeNull()
  })

  it("cancels item interactions when authoritative IDs disappear", () => {
    const store = createStore()
    const command = createMoveCommand("preview", "a")
    const { actions } = store.getState()

    actions.replaceSelection(["a", "b"], "a")
    expect(
      actions.startMoving({
        type: "moving",
        itemIds: ["a"],
        origin: {
          pointerId: 1,
          clientX: 10,
          clientY: 20,
          date: TEST_ANCHOR_DATE,
        },
        preview: command.changes,
      })
    ).toBe(true)

    actions.reconcileItemIds(new Set(["b"]))
    expect([...store.getState().selectedIds]).toEqual(["b"])
    expect(store.getState().interaction).toEqual({ type: "idle" })
  })

  it("turns deletion into one pending command and clears selection", () => {
    const store = createStore()
    const { actions } = store.getState()
    actions.replaceSelection(["a", "b"], "a")

    const command = actions.deleteSelection("delete-1")
    expect(command).toEqual({
      type: "delete",
      clientMutationId: "delete-1",
      itemIds: ["a", "b"],
    })
    expect(store.getState().selectedIds.size).toBe(0)
    expect(store.getState().undoStack).toHaveLength(1)
    expect(store.getState().pendingCommands).toHaveLength(1)
  })

  it("preserves state references for equivalent replacement and pruning", () => {
    const store = createStore()
    const { actions } = store.getState()
    actions.replaceSelection(["a", "b"], "a")
    const before = store.getState()

    actions.replaceSelection(["a", "b"], "a")
    actions.pruneSelection(new Set(["a", "b", "c"]))
    expect(store.getState()).toBe(before)
  })
})
