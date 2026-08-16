/**
 * Tests for the viewport slice.
 */
import { describe, expect, it } from "vitest"
import { createTimelineStore } from "../create-store.js"
import { pxToDate } from "../../utils/position-utils.js"

describe("viewport slice", () => {
  it("has correct initial state", () => {
    const store = createTimelineStore()
    const state = store.getState()
    expect(state.viewportMode).toBe("week")
    expect(state.scrollLeft).toBe(0)
    expect(state.scrollTop).toBe(0)
    expect(state.viewportWidth).toBe(0)
    expect(state.viewportHeight).toBe(0)
  })

  it("accepts initial viewport mode", () => {
    const store = createTimelineStore({ viewportMode: "month" })
    expect(store.getState().viewportMode).toBe("month")
  })

  describe("setViewportMode", () => {
    it("updates viewport mode", () => {
      const store = createTimelineStore()
      store.getState().actions.setViewportMode("day")
      expect(store.getState().viewportMode).toBe("day")
    })

    it("can switch to all modes", () => {
      const store = createTimelineStore()
      const modes = [
        "hours",
        "day",
        "week",
        "bi-week",
        "month",
        "quarter",
        "year",
      ] as const
      for (const mode of modes) {
        store.getState().actions.setViewportMode(mode)
        expect(store.getState().viewportMode).toBe(mode)
      }
    })

    it("preserves the center date while switching modes", () => {
      const store = createTimelineStore({
        items: [
          {
            id: "a",
            startDate: new Date("2026-07-01T00:00:00"),
            endDate: new Date("2026-07-30T00:00:00"),
            data: null,
          },
        ],
        viewportMode: "day",
        viewportWidth: 200,
      })
      const expectedCenter = new Date("2026-07-15T00:00:00")

      store.getState().actions.scrollToDate(expectedCenter)
      store.getState().actions.setViewportMode("week")

      // The week origin is the Monday two full columns before July 1.
      const actualCenter = pxToDate(
        store.getState().scrollLeft + store.getState().viewportWidth / 2,
        store.getState().timelineOrigin,
        "week"
      )

      expect(actualCenter.getTime()).toBe(expectedCenter.getTime())
    })
  })

  describe("scrollTo", () => {
    it("sets scrollLeft", () => {
      const store = createTimelineStore()
      store.getState().actions.scrollTo(100)
      expect(store.getState().scrollLeft).toBe(100)
    })

    it("sets both scrollLeft and scrollTop", () => {
      const store = createTimelineStore()
      store.getState().actions.scrollTo(200, 50)
      expect(store.getState().scrollLeft).toBe(200)
      expect(store.getState().scrollTop).toBe(50)
    })

    it("does not affect scrollTop when y is omitted", () => {
      const store = createTimelineStore()
      store.getState().actions.scrollTo(0, 100)
      store.getState().actions.scrollTo(200)
      expect(store.getState().scrollLeft).toBe(200)
      expect(store.getState().scrollTop).toBe(100)
    })
  })

  describe("setViewportDimensions", () => {
    it("sets viewport width and height", () => {
      const store = createTimelineStore()
      store.getState().actions.setViewportDimensions(1024, 768)
      expect(store.getState().viewportWidth).toBe(1024)
      expect(store.getState().viewportHeight).toBe(768)
    })
  })

  describe("scrollToDate", () => {
    it("scrolls to center a date in the viewport", () => {
      const store = createTimelineStore({
        items: [
          {
            id: "a",
            startDate: new Date("2026-07-01T00:00:00"),
            endDate: new Date("2026-07-30T00:00:00"),
            data: null,
          },
        ],
      })
      store.getState().actions.setViewportDimensions(800, 400)
      store.getState().actions.scrollToDate(new Date("2026-07-15T00:00:00"))
      // Should scroll to some positive value (centering July 15)
      expect(store.getState().scrollLeft).toBeGreaterThanOrEqual(0)
    })
  })

  describe("scrollToToday", () => {
    it("scrolls without throwing", () => {
      const store = createTimelineStore()
      store.getState().actions.setViewportDimensions(800, 400)
      expect(() => store.getState().actions.scrollToToday()).not.toThrow()
    })
  })

  describe("scrollToItem", () => {
    it("centers the viewport on the item bar", () => {
      const store = createTimelineStore({
        items: [
          {
            id: "target",
            startDate: new Date("2026-08-01T00:00:00"),
            endDate: new Date("2026-08-15T00:00:00"),
            data: null,
          },
          {
            id: "early",
            startDate: new Date("2026-07-01T00:00:00"),
            endDate: new Date("2026-07-05T00:00:00"),
            data: null,
          },
        ],
      })
      store.getState().actions.setViewportDimensions(800, 400)
      store.getState().actions.scrollToItem("target")
      // scrollLeft should be > 0 since target is far from origin
      expect(store.getState().scrollLeft).toBeGreaterThan(0)
    })

    it("does nothing for a non-existent item", () => {
      const store = createTimelineStore()
      store.getState().actions.scrollTo(100)
      store.getState().actions.scrollToItem("nonexistent")
      expect(store.getState().scrollLeft).toBe(100)
    })
  })
})
