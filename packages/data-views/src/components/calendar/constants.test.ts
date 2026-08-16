import { describe, expect, it, vi } from "vitest"
import {
  CALENDAR_VIEW_MODES,
  createDefaultCalendarPreferences,
  getBrowserTimeZone,
} from "./constants.js"

describe("calendar constants", () => {
  it("creates the canonical server-preference defaults", () => {
    const preferences = createDefaultCalendarPreferences()

    expect(preferences).toMatchObject({
      viewMode: "month",
      weekStartsOn: 1,
      showWeekends: true,
      density: "compact",
      maxVisibleLanes: 4,
      overflowBehavior: "popover",
      timeFormat: "12h",
    })
    expect(preferences.timeZone).toBe(getBrowserTimeZone())
    expect(CALENDAR_VIEW_MODES).toEqual(["month", "week", "agenda"])
  })

  it("falls back to UTC when the runtime does not expose a time zone", () => {
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "",
    })
    expect(getBrowserTimeZone()).toBe("UTC")
    spy.mockRestore()
  })
})
