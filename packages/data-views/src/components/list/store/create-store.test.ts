import { describe, expect, it } from "vitest"
import {
  createDataListStore,
  toPublicSelection,
} from "./create-store.js"
import { DATA_LIST_MAX_HISTORY } from "../constants.js"

describe("createDataListStore", () => {
  it("creates isolated instances", () => {
    const first = createDataListStore()
    const second = createDataListStore()
    first.getState().actions.setFocusedId("same-id")
    first.getState().actions.setSelection({
      kind: "explicit",
      ids: new Set(["same-id"]),
    })

    expect(second.getState().focusedId).toBeNull()
    expect(toPublicSelection(second.getState().selection)).toEqual({
      kind: "explicit",
      ids: [],
    })
  })

  it("reconciles removed selection, focus, edit, and open row state", () => {
    const store = createDataListStore({
      selection: { kind: "explicit", ids: ["gone", "visible"] },
    })
    const actions = store.getState().actions
    actions.setFocusedId("gone")
    actions.beginEdit("gone", "title", "Old")
    actions.setOpenRowId("gone")
    actions.reconcileItems(new Set(["visible"]), ["visible"])

    expect(toPublicSelection(store.getState().selection)).toEqual({
      kind: "explicit",
      ids: ["visible"],
    })
    expect(store.getState().focusedId).toBe("visible")
    expect(store.getState().edit.status).toBe("idle")
    expect(store.getState().openRowId).toBeNull()
  })

  it("bounds history and removes rejected descendants", () => {
    const store = createDataListStore()
    for (let index = 0; index < DATA_LIST_MAX_HISTORY + 5; index += 1) {
      store.getState().actions.pushHistory({
        type: "restore",
        itemIds: [`item-${index}`],
        mutationId: `mutation-${index}`,
      })
    }
    expect(store.getState().undoStack).toHaveLength(DATA_LIST_MAX_HISTORY)
    store.getState().actions.settleCommand("mutation-10", false)
    expect(store.getState().undoStack.at(-1)?.mutationId).toBe("mutation-9")
  })

  it("models all-matching selection without materializing remote IDs", () => {
    const store = createDataListStore({
      selection: {
        kind: "all-matching",
        excludedIds: ["item-2"],
        matchingCount: 50_000,
      },
    })
    expect(toPublicSelection(store.getState().selection)).toEqual({
      kind: "all-matching",
      excludedIds: ["item-2"],
      matchingCount: 50_000,
    })
  })
})
