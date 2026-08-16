/**
 * Tests for the interaction slice — drag state, hovered cell, ghost bar.
 */
import { describe, expect, it } from "vitest"
import { createTimelineStore } from "../create-store.js"

describe("interaction slice", () => {
  describe("initial state", () => {
    it("starts with null drag, hover, and ghost", () => {
      const store = createTimelineStore()
      const state = store.getState()
      expect(state.dragState).toBeNull()
      expect(state.hoveredCell).toBeNull()
      expect(state.ghostBar).toBeNull()
    })
  })

  describe("startDrag / updateDrag / endDrag", () => {
    it("transitions dragState through the full lifecycle", () => {
      const store = createTimelineStore()
      const { actions } = store.getState()

      // Start
      actions.startDrag({
        type: "move",
        itemIds: ["item-1"],
        originX: 100,
        currentX: 100,
        originScrollLeft: 0,
      })
      expect(store.getState().dragState).toEqual({
        type: "move",
        itemIds: ["item-1"],
        originX: 100,
        currentX: 100,
        originScrollLeft: 0,
      })

      // Update
      actions.updateDrag(200)
      expect(store.getState().dragState?.currentX).toBe(200)

      // End
      actions.endDrag()
      expect(store.getState().dragState).toBeNull()
    })

    it("supports multi-item drag", () => {
      const store = createTimelineStore()
      store.getState().actions.startDrag({
        type: "move",
        itemIds: ["item-1", "item-2", "item-3"],
        originX: 50,
        currentX: 50,
        originScrollLeft: 10,
      })

      const drag = store.getState().dragState
      expect(drag?.itemIds).toEqual(["item-1", "item-2", "item-3"])
    })

    it("supports resize-left drag type", () => {
      const store = createTimelineStore()
      store.getState().actions.startDrag({
        type: "resize-left",
        itemIds: ["item-1"],
        originX: 50,
        currentX: 50,
        originScrollLeft: 0,
      })
      expect(store.getState().dragState?.type).toBe("resize-left")
    })

    it("supports resize-right drag type", () => {
      const store = createTimelineStore()
      store.getState().actions.startDrag({
        type: "resize-right",
        itemIds: ["item-1"],
        originX: 50,
        currentX: 50,
        originScrollLeft: 0,
      })
      expect(store.getState().dragState?.type).toBe("resize-right")
    })

    it("updateDrag does nothing when no drag is active", () => {
      const store = createTimelineStore()
      store.getState().actions.updateDrag(999)
      expect(store.getState().dragState).toBeNull()
    })
  })

  describe("setHoveredCell / clearHoveredCell", () => {
    it("sets and clears hovered cell", () => {
      const store = createTimelineStore()
      const cell = { rowIndex: 2, date: new Date("2026-07-14") }

      store.getState().actions.setHoveredCell(cell)
      expect(store.getState().hoveredCell).toEqual(cell)

      store.getState().actions.clearHoveredCell()
      expect(store.getState().hoveredCell).toBeNull()
    })
  })

  describe("setGhostBar / clearGhostBar", () => {
    it("sets and clears ghost bar", () => {
      const store = createTimelineStore()
      const ghost = {
        rowIndex: 1,
        startDate: new Date("2026-07-14"),
        endDate: new Date("2026-07-21"),
      }

      store.getState().actions.setGhostBar(ghost)
      expect(store.getState().ghostBar).toEqual(ghost)

      store.getState().actions.clearGhostBar()
      expect(store.getState().ghostBar).toBeNull()
    })
  })
})
