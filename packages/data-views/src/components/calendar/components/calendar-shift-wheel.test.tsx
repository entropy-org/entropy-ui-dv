import { act, fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Calendar } from "./calendar.js"
import {
  createAllDayItem,
  createTestPreferences,
} from "../test/fixtures.js"
import { renderCalendar } from "../test/render-calendar.js"

describe("Calendar Shift+wheel scrolling", () => {
  it("scrolls horizontally while a calendar item is being held", () => {
    const onItemMutation = vi.fn()
    const { store } = renderCalendar(<Calendar />, undefined, {
      items: [createAllDayItem({ id: "held-task" })],
      onItemMutation,
      preferences: createTestPreferences({ weekStartsOn: 1 }),
    })
    const calendar = screen.getByTestId("calendar")
    Object.defineProperties(calendar, {
      clientWidth: { configurable: true, value: 600 },
      scrollWidth: { configurable: true, value: 1200 },
    })
    const task = screen
      .getByTestId("calendar-event-held-task")
      .querySelector("button")!
    const grid = screen.getByRole("grid")

    fireEvent.pointerDown(task, {
      button: 0,
      pointerId: 41,
      clientX: 50,
      clientY: 450,
    })
    act(() => {
      store.getState().actions.startMoving({
        type: "moving",
        itemIds: ["held-task"],
        origin: {
          pointerId: 41,
          clientX: 50,
          clientY: 450,
          date: "2026-07-27",
        },
        preview: [
          {
            itemId: "held-task",
            previousRange: {
              kind: "all-day",
              startDate: "2026-07-27",
              endDate: "2026-07-27",
            },
            nextRange: {
              kind: "all-day",
              startDate: "2026-07-28",
              endDate: "2026-07-28",
            },
          },
        ],
      })
    })
    expect(store.getState().interaction.type).toBe("moving")
    fireEvent.wheel(task, { deltaY: 140, shiftKey: true })

    expect(calendar.scrollLeft).toBe(140)

    fireEvent.pointerCancel(grid, { pointerId: 41 })
  })

  it("navigates the visible period when the calendar has no pixel overflow", () => {
    const onAnchorDateChange = vi.fn()
    const { store } = renderCalendar(<Calendar />, undefined, {
      onAnchorDateChange,
    })
    act(() => {
      store.getState().actions.startMoving({
        type: "moving",
        itemIds: ["all-day-1"],
        origin: {
          pointerId: 42,
          clientX: 50,
          clientY: 450,
          date: "2026-07-27",
        },
        preview: [
          {
            itemId: "all-day-1",
            previousRange: {
              kind: "all-day",
              startDate: "2026-07-27",
              endDate: "2026-07-27",
            },
            nextRange: {
              kind: "all-day",
              startDate: "2026-07-28",
              endDate: "2026-07-28",
            },
          },
        ],
      })
    })

    fireEvent.wheel(screen.getByTestId("calendar"), {
      deltaY: 120,
      shiftKey: true,
    })

    expect(onAnchorDateChange).toHaveBeenCalledWith("2026-08-27")
    expect(store.getState().interaction.type).toBe("moving")
  })
})
