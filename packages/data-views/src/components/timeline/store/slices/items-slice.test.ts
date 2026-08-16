/**
 * Tests for the items slice — CRUD + undo/redo.
 */
import { describe, expect, it } from "vitest"
import { createTimelineStore } from "../create-store.js"
import {
  createTestItem,
  createTestItems,
} from "../../test/fixtures.js"

describe("items slice", () => {
  describe("addItem", () => {
    it("adds an item to the store", () => {
      const store = createTimelineStore()
      const item = createTestItem({ id: "new-1" })
      store.getState().actions.addItem(item)

      expect(store.getState().items.size).toBe(1)
      expect(store.getState().items.get("new-1")).toEqual(item)
      expect(store.getState().itemOrder).toEqual(["new-1"])
    })

    it("appends to existing items", () => {
      const store = createTimelineStore({
        items: createTestItems(2),
      })
      const newItem = createTestItem({ id: "new-1" })
      store.getState().actions.addItem(newItem)

      expect(store.getState().items.size).toBe(3)
      expect(store.getState().itemOrder).toEqual(["item-1", "item-2", "new-1"])
    })
  })

  describe("updateItem", () => {
    it("updates an existing item's fields", () => {
      const store = createTimelineStore({
        items: createTestItems(1),
      })
      const newEnd = new Date("2026-12-31")
      store.getState().actions.updateItem("item-1", { endDate: newEnd })

      const updated = store.getState().items.get("item-1")
      expect(updated?.endDate).toEqual(newEnd)
    })

    it("does nothing for a non-existent item", () => {
      const store = createTimelineStore()
      store.getState().actions.updateItem("nonexistent", { data: "foo" })
      expect(store.getState().items.size).toBe(0)
    })

    it("preserves other items unchanged", () => {
      const store = createTimelineStore({
        items: createTestItems(3),
      })
      const originalItem2 = store.getState().items.get("item-2")
      store.getState().actions.updateItem("item-1", { data: "changed" })

      expect(store.getState().items.get("item-2")).toEqual(originalItem2)
    })
  })

  describe("removeItems", () => {
    it("removes items by ID", () => {
      const store = createTimelineStore({
        items: createTestItems(3),
      })
      store.getState().actions.removeItems(["item-1", "item-3"])

      expect(store.getState().items.size).toBe(1)
      expect(store.getState().items.has("item-2")).toBe(true)
      expect(store.getState().itemOrder).toEqual(["item-2"])
    })

    it("handles removing non-existent IDs gracefully", () => {
      const store = createTimelineStore({
        items: createTestItems(2),
      })
      store.getState().actions.removeItems(["nonexistent"])
      expect(store.getState().items.size).toBe(2)
    })
  })

  describe("setItems", () => {
    it("replaces all items", () => {
      const store = createTimelineStore({
        items: createTestItems(3),
      })
      const newItems = [
        createTestItem({ id: "x" }),
        createTestItem({ id: "y" }),
      ]
      store.getState().actions.setItems(newItems)

      expect(store.getState().items.size).toBe(2)
      expect(store.getState().itemOrder).toEqual(["x", "y"])
    })
  })

  describe("undo / redo", () => {
    it("undoes an addItem", () => {
      const store = createTimelineStore()
      store.getState().actions.addItem(createTestItem({ id: "a" }))
      expect(store.getState().items.size).toBe(1)

      store.getState().actions.undo()
      expect(store.getState().items.size).toBe(0)
    })

    it("redoes an undone addItem", () => {
      const store = createTimelineStore()
      store.getState().actions.addItem(createTestItem({ id: "a" }))
      store.getState().actions.undo()
      expect(store.getState().items.size).toBe(0)

      store.getState().actions.redo()
      expect(store.getState().items.size).toBe(1)
      expect(store.getState().items.has("a")).toBe(true)
    })

    it("undoes an updateItem", () => {
      const store = createTimelineStore({
        items: [createTestItem({ id: "a", data: "original" })],
      })
      store.getState().actions.updateItem("a", { data: "modified" })
      expect(store.getState().items.get("a")?.data).toBe("modified")

      store.getState().actions.undo()
      expect(store.getState().items.get("a")?.data).toBe("original")
    })

    it("undoes a removeItems", () => {
      const store = createTimelineStore({
        items: createTestItems(2),
      })
      store.getState().actions.removeItems(["item-1"])
      expect(store.getState().items.size).toBe(1)

      store.getState().actions.undo()
      expect(store.getState().items.size).toBe(2)
      expect(store.getState().itemOrder).toEqual(["item-1", "item-2"])
    })

    it("clears redo stack after a new mutation", () => {
      const store = createTimelineStore()
      store.getState().actions.addItem(createTestItem({ id: "a" }))
      store.getState().actions.undo()
      expect(store.getState().redoStack.length).toBe(1)

      store.getState().actions.addItem(createTestItem({ id: "b" }))
      expect(store.getState().redoStack.length).toBe(0)
    })

    it("does nothing when undo stack is empty", () => {
      const store = createTimelineStore()
      store.getState().actions.undo()
      expect(store.getState().items.size).toBe(0)
    })

    it("does nothing when redo stack is empty", () => {
      const store = createTimelineStore()
      store.getState().actions.redo()
      expect(store.getState().items.size).toBe(0)
    })

    it("supports multiple undo/redo cycles", () => {
      const store = createTimelineStore()
      store.getState().actions.addItem(createTestItem({ id: "a" }))
      store.getState().actions.addItem(createTestItem({ id: "b" }))
      store.getState().actions.addItem(createTestItem({ id: "c" }))

      store.getState().actions.undo() // remove c
      store.getState().actions.undo() // remove b
      expect(store.getState().items.size).toBe(1)
      expect(store.getState().items.has("a")).toBe(true)

      store.getState().actions.redo() // re-add b
      expect(store.getState().items.size).toBe(2)
      expect(store.getState().items.has("b")).toBe(true)
    })

    it("caps history at 50 entries and evicts the oldest snapshot", () => {
      const store = createTimelineStore({
        items: [createTestItem({ id: "a", data: 0 })],
      })

      for (let value = 1; value <= 51; value += 1) {
        store.getState().actions.updateItem("a", { data: value })
      }

      expect(store.getState().undoStack).toHaveLength(50)

      for (let count = 0; count < 50; count += 1) {
        store.getState().actions.undo()
      }

      expect(store.getState().items.get("a")?.data).toBe(1)
      store.getState().actions.undo()
      expect(store.getState().items.get("a")?.data).toBe(1)
    })
  })
})
