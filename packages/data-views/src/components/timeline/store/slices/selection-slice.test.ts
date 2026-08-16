/**
 * Tests for the selection slice.
 */
import { describe, expect, it } from "vitest"
import { createTimelineStore } from "../create-store.js"
import { createTestItems } from "../../test/fixtures.js"

describe("selection slice", () => {
  describe("initial state", () => {
    it("starts with empty selection", () => {
      const store = createTimelineStore()
      expect(store.getState().selectedIds.size).toBe(0)
    })
  })

  describe("select — replace mode", () => {
    it("selects a single item, clearing previous selection", () => {
      const store = createTimelineStore({
        items: createTestItems(3),
      })
      const { actions } = store.getState()

      actions.select("item-1", "replace")
      expect(store.getState().selectedIds).toEqual(new Set(["item-1"]))

      actions.select("item-2", "replace")
      expect(store.getState().selectedIds).toEqual(new Set(["item-2"]))
    })
  })

  describe("select — toggle mode", () => {
    it("adds an item to the selection", () => {
      const store = createTimelineStore({
        items: createTestItems(3),
      })
      store.getState().actions.select("item-1", "replace")
      store.getState().actions.select("item-2", "toggle")
      expect(store.getState().selectedIds).toEqual(
        new Set(["item-1", "item-2"])
      )
    })

    it("removes an already-selected item", () => {
      const store = createTimelineStore({
        items: createTestItems(3),
      })
      store.getState().actions.select("item-1", "replace")
      store.getState().actions.select("item-1", "toggle")
      expect(store.getState().selectedIds.size).toBe(0)
    })
  })

  describe("select — range mode", () => {
    it("selects a contiguous range from anchor to target", () => {
      const store = createTimelineStore({
        items: createTestItems(5),
      })
      store.getState().actions.select("item-2", "replace")
      store.getState().actions.select("item-4", "range")

      expect(store.getState().selectedIds).toEqual(
        new Set(["item-2", "item-3", "item-4"])
      )
    })

    it("selects a range going backwards", () => {
      const store = createTimelineStore({
        items: createTestItems(5),
      })
      store.getState().actions.select("item-4", "replace")
      store.getState().actions.select("item-2", "range")

      expect(store.getState().selectedIds).toEqual(
        new Set(["item-2", "item-3", "item-4"])
      )
    })

    it("falls back to replace when no previous selection exists", () => {
      const store = createTimelineStore({
        items: createTestItems(3),
      })
      store.getState().actions.select("item-2", "range")
      expect(store.getState().selectedIds).toEqual(new Set(["item-2"]))
    })
  })

  describe("selectAll", () => {
    it("selects all items in order", () => {
      const store = createTimelineStore({
        items: createTestItems(3),
      })
      store.getState().actions.selectAll()
      expect(store.getState().selectedIds).toEqual(
        new Set(["item-1", "item-2", "item-3"])
      )
    })

    it("works with empty items", () => {
      const store = createTimelineStore()
      store.getState().actions.selectAll()
      expect(store.getState().selectedIds.size).toBe(0)
    })
  })

  describe("clearSelection", () => {
    it("clears all selections", () => {
      const store = createTimelineStore({
        items: createTestItems(3),
      })
      store.getState().actions.selectAll()
      store.getState().actions.clearSelection()
      expect(store.getState().selectedIds.size).toBe(0)
    })
  })

  describe("deleteSelected", () => {
    it("removes selected items from the store", () => {
      const store = createTimelineStore({
        items: createTestItems(3),
      })
      store.getState().actions.select("item-1", "replace")
      store.getState().actions.select("item-3", "toggle")
      store.getState().actions.deleteSelected()

      expect(store.getState().items.size).toBe(1)
      expect(store.getState().items.has("item-2")).toBe(true)
      expect(store.getState().selectedIds.size).toBe(0)
    })

    it("does nothing when nothing is selected", () => {
      const store = createTimelineStore({
        items: createTestItems(2),
      })
      store.getState().actions.deleteSelected()
      expect(store.getState().items.size).toBe(2)
    })
  })
})
