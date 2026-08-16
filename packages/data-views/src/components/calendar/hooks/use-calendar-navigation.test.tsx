import { act } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useCalendarNavigationActions } from "./use-calendar-navigation.js"
import {
  createTestPreferences,
  TEST_ANCHOR_DATE,
} from "../test/fixtures.js"
import { renderCalendarHook } from "../test/render-calendar.js"

describe("useCalendarNavigationActions", () => {
  it("uses the controlled view mode and reports changed anchors", () => {
    const onAnchorDateChange = vi.fn()
    const { result } = renderCalendarHook(
      useCalendarNavigationActions,
      undefined,
      {
        preferences: createTestPreferences({ viewMode: "week" }),
        onAnchorDateChange,
      }
    )

    act(() => expect(result.current.next()).toBe("2026-08-03"))
    act(() => expect(result.current.previous()).toBe(TEST_ANCHOR_DATE))
    expect(onAnchorDateChange).toHaveBeenNthCalledWith(1, "2026-08-03")
    expect(onAnchorDateChange).toHaveBeenNthCalledWith(2, TEST_ANCHOR_DATE)
  })

  it("resolves today through the injected clock and controlled time zone", () => {
    const onAnchorDateChange = vi.fn()
    const { result, store } = renderCalendarHook(
      useCalendarNavigationActions,
      undefined,
      {
        initialAnchorDate: "2026-07-27",
        now: () => new Date("2026-07-27T01:00:00.000Z"),
        preferences: createTestPreferences({
          timeZone: "America/Los_Angeles",
        }),
        onAnchorDateChange,
      }
    )

    act(() => expect(result.current.today()).toBe("2026-07-26"))
    expect(store.getState().focusedDate).toBe("2026-07-26")
    expect(onAnchorDateChange).toHaveBeenCalledWith("2026-07-26")

    act(() => expect(result.current.toDate("2026-07-26")).toBe("2026-07-26"))
    expect(onAnchorDateChange).toHaveBeenCalledTimes(1)
  })
})
