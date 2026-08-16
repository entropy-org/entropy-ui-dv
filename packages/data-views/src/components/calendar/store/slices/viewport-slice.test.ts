import { describe, expect, it } from "vitest"
import { createCalendarStore } from "../create-store.js"

describe("calendar viewport slice", () => {
  it("navigates week and month periods while preserving a meaningful day", () => {
    const store = createCalendarStore({ initialAnchorDate: "2024-01-31" })
    const { actions } = store.getState()

    expect(actions.navigateByPeriod("next", "month")).toBe("2024-02-29")
    expect(actions.navigateByPeriod("previous", "month")).toBe("2024-01-29")
    expect(actions.setAnchorDate("2026-12-31")).toBe("2026-12-31")
    expect(actions.navigateByPeriod("next", "week")).toBe("2027-01-07")
    expect(actions.navigateByPeriod("previous", "week")).toBe("2026-12-31")
  })

  it("moves focus and resolves configured week boundaries", () => {
    const store = createCalendarStore({ initialAnchorDate: "2026-07-29" })
    const { actions } = store.getState()

    expect(actions.moveFocusedDate(2)).toBe("2026-07-31")
    expect(actions.moveFocusToWeekBoundary("start", 1)).toBe("2026-07-27")
    expect(actions.moveFocusToWeekBoundary("end", 1)).toBe("2026-08-02")
    expect(store.getState().anchorDate).toBe("2026-07-29")
  })

  it("navigates to today and clamps non-finite viewport dimensions", () => {
    const store = createCalendarStore({ initialAnchorDate: "2026-07-01" })
    const { actions } = store.getState()

    expect(actions.goToToday("2026-08-08")).toBe("2026-08-08")
    expect(store.getState().focusedDate).toBe("2026-08-08")
    actions.setViewportDimensions(Number.NaN, -40)
    expect(store.getState().viewportWidth).toBe(0)
    expect(store.getState().viewportHeight).toBe(0)
  })

  it("preserves the state reference for no-op setters and rejects invalid dates", () => {
    const store = createCalendarStore({ initialAnchorDate: "2026-07-27" })
    const before = store.getState()

    before.actions.setAnchorDate("2026-07-27")
    before.actions.setFocusedDate(null)
    before.actions.setViewportDimensions(0, 0)
    expect(store.getState()).toBe(before)
    expect(() => before.actions.setAnchorDate("2026-02-30")).toThrow(
      "Invalid calendar date"
    )
  })

  it("accepts an initial focus and updates finite viewport dimensions", () => {
    const store = createCalendarStore({
      initialAnchorDate: "2026-07-27",
      initialFocusedDate: "2026-07-28",
    })
    expect(store.getState().focusedDate).toBe("2026-07-28")
    store.getState().actions.setViewportDimensions(800, 600)
    expect(store.getState()).toMatchObject({
      viewportWidth: 800,
      viewportHeight: 600,
    })
  })
})
