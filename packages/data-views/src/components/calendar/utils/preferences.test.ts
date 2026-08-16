import { act } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useCalendarPreferencesChange } from "../hooks/use-calendar-preferences.js"
import { createTestPreferences } from "../test/fixtures.js"
import { renderCalendarHook } from "../test/render-calendar.js"
import type { CalendarPreferencesChange } from "../types.js"
import { applyCalendarPreferenceChange } from "./preferences.js"

describe("calendar controlled preferences", () => {
  it("applies every preference variant immutably", () => {
    const original = createTestPreferences()
    const changes = [
      { type: "view-mode", value: "week" },
      { type: "week-start", value: 0 },
      { type: "weekends", value: false },
      { type: "density", value: "comfortable" },
      { type: "max-visible-lanes", value: 7 },
      { type: "overflow-behavior", value: "expand-week" },
      { type: "visible-calendars", value: ["work", "personal"] },
      { type: "time-zone", value: "UTC" },
      { type: "time-format", value: "24h" },
      { type: "agenda-span", value: { type: "custom", dayCount: 5 } },
      { type: "agenda-snap", value: 30 },
      { type: "agenda-hour-height", value: 80 },
      { type: "agenda-working-hours", value: { startMinutes: 480, endMinutes: 1080 } },
      { type: "agenda-initial-scroll", value: 420 },
      { type: "agenda-all-day-section", value: false },
    ] as const satisfies readonly CalendarPreferencesChange[]

    const next = changes.reduce(applyCalendarPreferenceChange, original)
    expect(next).toEqual({
      viewMode: "week",
      weekStartsOn: 0,
      showWeekends: false,
      density: "comfortable",
      maxVisibleLanes: 7,
      overflowBehavior: "expand-week",
      visibleCalendarIds: ["work", "personal"],
      timeZone: "UTC",
      timeFormat: "24h",
      agenda: {
        span: { type: "custom", dayCount: 5 },
        snapMinutes: 30,
        hourHeight: 80,
        workingHours: { startMinutes: 480, endMinutes: 1080 },
        initialScrollMinutes: 420,
        showAllDaySection: false,
      },
    })
    expect(original).toEqual(createTestPreferences())
  })

  it("preserves preference references for no-op changes and validates values", () => {
    const preferences = createTestPreferences()
    expect(
      applyCalendarPreferenceChange(preferences, {
        type: "view-mode",
        value: preferences.viewMode,
      })
    ).toBe(preferences)
    const withCalendars = createTestPreferences({
      visibleCalendarIds: ["work", "personal"],
    })
    expect(
      applyCalendarPreferenceChange(withCalendars, {
        type: "visible-calendars",
        value: ["work", "personal"],
      })
    ).toBe(withCalendars)
    expect(
      applyCalendarPreferenceChange(withCalendars, {
        type: "visible-calendars",
        value: ["work", "family"],
      }).visibleCalendarIds
    ).toEqual(["work", "family"])
    expect(() =>
      applyCalendarPreferenceChange(preferences, {
        type: "max-visible-lanes",
        value: -1,
      })
    ).toThrow("non-negative integer")
    expect(() =>
      applyCalendarPreferenceChange(preferences, {
        type: "time-zone",
        value: "Not/A_Zone",
      })
    ).toThrow()
    for (const change of [
      { type: "agenda-hour-height", value: Number.NaN },
      { type: "agenda-hour-height", value: 31 },
      { type: "agenda-hour-height", value: 241 },
      { type: "agenda-initial-scroll", value: 1.5 },
      { type: "agenda-initial-scroll", value: -1 },
      { type: "agenda-initial-scroll", value: 1440 },
    ] as const satisfies readonly CalendarPreferencesChange[]) {
      expect(() => applyCalendarPreferenceChange(preferences, change)).toThrow()
    }

    const noOps = [
      { type: "week-start", value: preferences.weekStartsOn },
      { type: "weekends", value: preferences.showWeekends },
      { type: "density", value: preferences.density },
      { type: "max-visible-lanes", value: preferences.maxVisibleLanes },
      { type: "overflow-behavior", value: preferences.overflowBehavior },
      { type: "time-zone", value: preferences.timeZone },
      { type: "time-format", value: preferences.timeFormat },
    ] as const satisfies readonly CalendarPreferencesChange[]
    for (const change of noOps) {
      expect(applyCalendarPreferenceChange(preferences, change)).toBe(preferences)
    }
  })

  it("bridges changes to the controlled callback without writing preferences to Zustand", () => {
    const onPreferencesChange = vi.fn()
    const { result, store, config } = renderCalendarHook(
      useCalendarPreferencesChange,
      undefined,
      { onPreferencesChange }
    )

    let next = config.preferences
    act(() => {
      next = result.current({ type: "weekends", value: false })
    })
    expect(next.showWeekends).toBe(false)
    expect(onPreferencesChange).toHaveBeenCalledWith(next, {
      type: "weekends",
      value: false,
    })
    expect(store.getState()).not.toHaveProperty("preferences")

    act(() => {
      result.current({ type: "view-mode", value: config.preferences.viewMode })
    })
    expect(onPreferencesChange).toHaveBeenCalledTimes(1)
  })
})
