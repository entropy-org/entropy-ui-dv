import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Calendar } from "./calendar.js"
import { CalendarDayCell } from "./calendar-day-cell.js"
import { CalendarEvent } from "./calendar-event.js"
import { CalendarSearch } from "./calendar-search.js"
import { buildMonthGrid } from "../utils/date-grid.js"
import {
  createAllDayItem,
  createTestPreferences,
} from "../test/fixtures.js"
import { renderCalendar } from "../test/render-calendar.js"

describe("calendar presentational components", () => {
  it("forwards refs and preserves consumer classes on day cells and events", () => {
    const cellRef = React.createRef<HTMLButtonElement>()
    const eventRef = React.createRef<HTMLDivElement>()
    const cell = buildMonthGrid("2026-07-27", {
      weekStartsOn: 1,
      showWeekends: true,
      locale: "en-US",
    }).cells[0]
    const item = createAllDayItem({ id: "ref-item" })
    render(
      <>
        <CalendarDayCell ref={cellRef} cell={cell} className="consumer-cell" />
        <CalendarEvent
          ref={eventRef}
          item={item}
          date={item.startDate}
          renderState={{
            isSelected: false,
            isHovered: false,
            interaction: { type: "idle" },
          }}
          content="Ref item"
          ariaLabel="Ref item"
          isRangeStart
          isRangeEnd
          continuedBefore={false}
          continuedAfter={false}
          readOnly
          onItemClick={vi.fn()}
          onItemDoubleClick={vi.fn()}
          onItemPointerDown={vi.fn()}
          onResizePointerDown={vi.fn()}
          onResizeKeyDown={vi.fn()}
          className="consumer-event"
        />
      </>
    )
    expect(cellRef.current).toHaveClass("consumer-cell")
    expect(eventRef.current).toHaveClass("consumer-event")
  })

  it("searches, clears with Escape and the clear button, and preserves input callbacks", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    const onKeyDown = vi.fn()
    const { rerender } = render(
      <CalendarSearch
        value="road"
        onValueChange={onValueChange}
        onKeyDown={onKeyDown}
      />
    )
    const input = screen.getByLabelText("Search calendar")
    fireEvent.keyDown(input, { key: "Escape" })
    expect(onKeyDown).toHaveBeenCalled()
    expect(onValueChange).toHaveBeenCalledWith("")
    await user.click(screen.getByLabelText("Clear calendar search"))
    expect(onValueChange).toHaveBeenCalledTimes(2)

    rerender(<CalendarSearch value="" onValueChange={onValueChange} />)
    await user.type(screen.getByLabelText("Search calendar"), "x")
    expect(onValueChange).toHaveBeenCalledWith("x")
  })
})

describe("calendar composed controls", () => {
  it("opens overflow, renders custom overflow items, selects one, and closes", async () => {
    const onItemClick = vi.fn()
    renderCalendar(<Calendar />, undefined, {
      preferences: createTestPreferences({ maxVisibleLanes: 1 }),
      items: [
        createAllDayItem({ id: "first" }),
        createAllDayItem({ id: "second" }),
        createAllDayItem({ id: "third" }),
      ],
      renderOverflowItem: (item) => `overflow:${item.id}`,
      onItemClick,
    })
    fireEvent.click(screen.getByRole("button", { name: /2 more events/ }))
    const hidden = await screen.findByRole("button", {
      name: "overflow:second",
    })
    fireEvent.click(hidden)
    expect(onItemClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "second" })
    )
    await waitFor(() =>
      expect(screen.queryByText("overflow:second")).not.toBeInTheDocument()
    )
  })

  it("emits controlled view and settings changes without storing preferences", async () => {
    const user = userEvent.setup()
    const onPreferencesChange = vi.fn()
    const { store } = renderCalendar(<Calendar />, undefined, {
      onPreferencesChange,
    })
    fireEvent.keyDown(screen.getByTestId("calendar"), { key: "w" })
    expect(onPreferencesChange).toHaveBeenCalledWith(
      expect.objectContaining({ viewMode: "week" }),
      { type: "view-mode", value: "week" }
    )

    await user.click(screen.getByTestId("calendar-settings-trigger"))
    const panel = await screen.findByTestId("calendar-settings-panel")
    expect(panel).toBeInTheDocument()
    await user.click(screen.getByLabelText("Show weekends"))
    expect(onPreferencesChange).toHaveBeenCalledWith(
      expect.objectContaining({ showWeekends: false }),
      { type: "weekends", value: false }
    )
    expect(store.getState()).not.toHaveProperty("preferences")
  })
})
