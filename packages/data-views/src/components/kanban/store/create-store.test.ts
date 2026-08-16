import { describe, expect, it } from "vitest"
import { createKanbanStore } from "./create-store.js"
import type { KanbanCommand, KanbanHistoryEntry } from "../types.js"

const command: KanbanCommand = { type: "delete-cards", clientMutationId: "m", cardIds: ["a"], sources: { a: { groupId: "g", rank: "a" } } }
const inverse: KanbanCommand = { type: "restore-cards", clientMutationId: "i", cardIds: ["a"], destinations: { a: { groupId: "g", rank: "a" } } }

describe("createKanbanStore", () => {
  it("supports replace, toggle, range, select-visible, and reconciliation", () => {
    const store = createKanbanStore()
    const actions = store.getState().actions
    actions.select("b", "replace")
    actions.select("c", "toggle")
    expect(store.getState().selectedIds).toEqual(new Set(["b", "c"]))
    actions.select("a", "range", ["a", "b", "c"])
    expect(store.getState().selectedIds).toEqual(new Set(["a", "b", "c"]))
    actions.reconcileCardIds(new Set(["b"]), ["b"])
    expect(store.getState().selectedIds).toEqual(new Set(["b"]))
    actions.selectVisible(["b", "d"])
    expect(store.getState().selectedIds.size).toBe(2)
    actions.clearSelection()
    expect(store.getState().selectionAnchorId).toBeNull()
  })

  it("bounds history, clears redo for new work, and settles pending operations", () => {
    const store = createKanbanStore({ historyLimit: 1 })
    const entry: KanbanHistoryEntry = { command, inverse }
    store.getState().actions.enqueueCommand({ status: "submitting", command, affectedCardIds: ["a"], createdAt: 0, sequence: 1 }, entry)
    expect(store.getState().pending).toHaveLength(1)
    expect(store.getState().actions.popUndo()).toEqual(entry)
    expect(store.getState().redoStack).toHaveLength(1)
    store.getState().actions.settleCommand("m", "rejected")
    expect(store.getState().pending).toHaveLength(0)
  })

  it("creates isolated stores even when IDs overlap", () => {
    const first = createKanbanStore()
    const second = createKanbanStore()
    first.getState().actions.select("same", "replace")
    expect(second.getState().selectedIds).toEqual(new Set())
  })
})
