import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Calendar } from "./calendar.js"
import { CalendarProvider } from "../context/calendar-provider.js"
import { useCalendarStoreApi } from "../context/calendar-context.js"
import type { CalendarStore } from "../store/create-store.js"
import {
  createMoveCommand,
  createTestConfig,
  createTestPreferences,
} from "../test/fixtures.js"
import { renderCalendar } from "../test/render-calendar.js"
import { getCalendarVisibleRange } from "../utils/data-integration.js"

describe("Calendar production data states", () => {
  it("blocks mismatched/loading payloads and keeps partial refresh data interactive", () => {
    const preferences = createTestPreferences()
    const range = getCalendarVisibleRange("2026-07-27", preferences)
    const loading = renderCalendar(<Calendar />, undefined, {
      preferences,
      dataState: { status: "loading", rangeKey: range.key },
    })
    expect(screen.getByTestId("calendar")).toHaveAttribute("aria-busy", "true")
    expect(screen.getByTestId("calendar-data-state")).toHaveTextContent(
      "Loading calendar data"
    )
    expect(screen.queryByTestId("calendar-month-view")).not.toBeInTheDocument()
    loading.renderResult.unmount()

    renderCalendar(<Calendar />, undefined, {
      preferences,
      dataState: {
        status: "refreshing",
        rangeKey: range.key,
        coverage: "partial",
      },
    })
    expect(screen.getByTestId("calendar-data-state")).toHaveTextContent(
      "some events are not loaded"
    )
    expect(screen.getByTestId("calendar-month-view")).toBeInTheDocument()
  })

  it("reports the exact query range and exposes recoverable errors", async () => {
    const preferences = createTestPreferences({ viewMode: "week" })
    const range = getCalendarVisibleRange("2026-07-27", preferences)
    const onVisibleRangeChange = vi.fn()
    const onDataRetry = vi.fn()
    renderCalendar(<Calendar />, undefined, {
      preferences,
      dataState: {
        status: "error",
        rangeKey: range.key,
        error: new Error("offline"),
        hasUsableData: false,
      },
      onVisibleRangeChange,
      onDataRetry,
    })

    await waitFor(() =>
      expect(onVisibleRangeChange).toHaveBeenCalledWith(range)
    )
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(onDataRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId("calendar-week-view")).not.toBeInTheDocument()
  })

  it("cancels an active gesture when navigation changes the query range", async () => {
    let store!: CalendarStore
    function CaptureStore() {
      store = useCalendarStoreApi()
      return null
    }
    render(
      <CalendarProvider config={createTestConfig()}>
        <CaptureStore />
        <Calendar />
      </CalendarProvider>
    )
    act(() => {
      const command = createMoveCommand()
      store.getState().actions.startMoving({
        type: "moving",
        itemIds: ["all-day-1"],
        origin: {
          pointerId: 1,
          clientX: 0,
          clientY: 0,
          date: "2026-07-27",
        },
        preview: command.changes,
      })
    })

    fireEvent.click(screen.getByRole("button", { name: "Next period" }))
    await waitFor(() => expect(store.getState().interaction.type).toBe("idle"))
    expect(store.getState().announcement).toContain("visible range changed")
  })
})
