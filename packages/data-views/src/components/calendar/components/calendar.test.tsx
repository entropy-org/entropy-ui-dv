import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Calendar } from "./calendar.js"
import { renderCalendar } from "../test/render-calendar.js"
import {
  createAllDayItem,
  createTestPreferences,
} from "../test/fixtures.js"

describe("Calendar", () => {
  it("renders the month shell, weekday header, cells, today, and events", () => {
    renderCalendar(<Calendar />, undefined, {
      items: [
        createAllDayItem({
          id: "launch",
          startDate: "2026-07-27",
          endDate: "2026-08-04",
        }),
      ],
      renderItem: (item, state) => `${item.id}:${state.isSelected}`,
    })

    expect(screen.getByTestId("calendar-controls")).toBeInTheDocument()
    expect(screen.getByTestId("calendar-title")).toHaveTextContent("July 2026")
    expect(screen.getByTestId("calendar-weekday-header")).toBeInTheDocument()
    expect(screen.getAllByTestId("calendar-event-launch")).toHaveLength(1)
    expect(screen.getByTestId("calendar-event-launch")).toHaveAttribute(
      "data-calendar-event-segment-date",
      "2026-07-27"
    )
    expect(screen.getByLabelText("Mon, 2026-07-27")).toHaveTextContent("27")
  })

  it("can hide its built-in header without hiding the date grid", () => {
    renderCalendar(<Calendar showHeader={false} />)

    expect(screen.queryByTestId("calendar-controls")).not.toBeInTheDocument()
    expect(screen.getByTestId("calendar-month-view")).toBeInTheDocument()
  })

  it("renders one full-height five-column week when weekends are hidden", () => {
    renderCalendar(<Calendar />, undefined, {
      preferences: createTestPreferences({
        viewMode: "week",
        showWeekends: false,
        weekStartsOn: 1,
      }),
      items: [createAllDayItem({ id: "week-item" })],
    })

    expect(screen.getByTestId("calendar-week-view")).toBeInTheDocument()
    expect(
      screen.getByTestId("calendar-week-view").querySelectorAll("button[role='gridcell']")
    ).toHaveLength(5)
    expect(
      screen.queryByTestId("calendar-weekday-header")
    ).not.toBeInTheDocument()
  })

  it("supports selection, select-all, deletion, and read-only affordances", () => {
    const onItemMutation = vi.fn()
    const { renderResult } = renderCalendar(<Calendar />, undefined, {
      onItemMutation,
    })
    fireEvent.click(
      screen.getByTestId("calendar-event-all-day-1").querySelector("button")!
    )
    expect(screen.getByText("1 selected")).toBeInTheDocument()
    fireEvent.keyDown(screen.getByTestId("calendar"), {
      key: "a",
      ctrlKey: true,
    })
    expect(screen.getByText("2 selected")).toBeInTheDocument()
    fireEvent.keyDown(screen.getByTestId("calendar"), { key: "Delete" })
    expect(onItemMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "delete",
        itemIds: ["all-day-1", "timed-1"],
      })
    )

    renderResult.unmount()
    renderCalendar(<Calendar />, undefined, { readOnly: true })
    expect(screen.queryByLabelText(/Resize .* start/)).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByTestId("calendar"), { key: "Delete" })
    expect(onItemMutation).toHaveBeenCalledTimes(1)
  })

  it("supports toggle and range selection while sharing hover state", () => {
    const { store } = renderCalendar(<Calendar />)
    const first = screen
      .getByTestId("calendar-event-all-day-1")
      .querySelector("button")!
    const second = screen
      .getByTestId("calendar-event-timed-1")
      .querySelector("button")!
    fireEvent.click(first)
    fireEvent.click(second, { ctrlKey: true })
    expect(store.getState().selectedIds).toEqual(
      new Set(["all-day-1", "timed-1"])
    )
    fireEvent.click(second, { ctrlKey: true })
    expect(store.getState().selectedIds).toEqual(new Set(["all-day-1"]))
    fireEvent.click(first)
    fireEvent.click(second, { shiftKey: true })
    expect(store.getState().selectedIds.size).toBe(2)
    fireEvent.mouseEnter(screen.getByTestId("calendar-event-all-day-1"))
    expect(screen.getByTestId("calendar-event-all-day-1")).toHaveAttribute(
      "data-hovered",
      "true"
    )
    fireEvent.mouseLeave(screen.getByTestId("calendar-event-all-day-1"))
    expect(screen.getByTestId("calendar-event-all-day-1")).not.toHaveAttribute(
      "data-hovered"
    )
  })

  it("can open items without selecting them", () => {
    const onItemClick = vi.fn()
    const { store } = renderCalendar(<Calendar />, undefined, {
      selection: { mode: "none" },
      onItemClick,
    })
    const event = screen
      .getByTestId("calendar-event-all-day-1")
      .querySelector("button")!

    fireEvent.click(event, { ctrlKey: true })
    fireEvent.keyDown(screen.getByTestId("calendar"), {
      key: "a",
      ctrlKey: true,
    })

    expect(onItemClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "all-day-1" })
    )
    expect(store.getState().selectedIds.size).toBe(0)
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument()
    expect(event).toHaveClass("cursor-pointer", "select-none")
    expect(event).toHaveAttribute("aria-pressed", "false")
  })

  it("creates with the keyboard and emits equivalent bulk keyboard movement", () => {
    const onItemCreate = vi.fn()
    const onItemMutation = vi.fn()
    renderCalendar(<Calendar />, undefined, { onItemCreate, onItemMutation })
    const cell = screen.getByLabelText("Mon, 2026-07-27")
    fireEvent.focus(cell)
    fireEvent.keyDown(cell, { key: "Enter" })
    expect(onItemCreate).toHaveBeenCalledWith(
      { kind: "all-day", startDate: "2026-07-27", endDate: "2026-07-27" },
      { viewMode: "month", source: "keyboard" }
    )

    fireEvent.click(
      screen.getByTestId("calendar-event-all-day-1").querySelector("button")!
    )
    fireEvent.keyDown(screen.getByTestId("calendar"), {
      key: "ArrowRight",
      altKey: true,
    })
    expect(onItemMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "move",
        changes: [
          expect.objectContaining({
            itemId: "all-day-1",
            nextRange: expect.objectContaining({ startDate: "2026-07-28" }),
          }),
        ],
      })
    )
  })

  it("shows custom and search empty states", () => {
    const { store, renderResult } = renderCalendar(<Calendar />, undefined, {
      items: [],
      renderEmptyState: () => <p>Custom empty</p>,
    })
    expect(screen.getByText("Custom empty")).toBeInTheDocument()
    renderResult.unmount()

    const result = renderCalendar(<Calendar />, undefined, {
      items: [createAllDayItem({ id: "alpha", data: { title: "Alpha" } })],
      getSearchText: (item) => String((item.data as { title: string }).title),
    })
    act(() => result.store.getState().actions.setSearchQuery("missing"))
    expect(
      screen.getByTestId("calendar-search-empty-state")
    ).toBeInTheDocument()
    expect(store.getState().searchQuery).toBe("")
  })

  it("uses pointer capture for one-day creation and date-snapped movement", () => {
    const onItemCreate = vi.fn()
    const onItemMutation = vi.fn()
    renderCalendar(<Calendar />, undefined, {
      onItemCreate,
      onItemMutation,
      items: [createAllDayItem({ id: "drag-me" })],
      preferences: createTestPreferences({ weekStartsOn: 1 }),
    })
    const grid = screen.getByTestId("calendar-month-view")
    grid.getBoundingClientRect = () =>
      ({
        left: 0,
        right: 700,
        top: 0,
        bottom: 500,
        width: 700,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect

    const event = screen
      .getByTestId("calendar-event-drag-me")
      .querySelector("button")!
    fireEvent.pointerDown(event, {
      pointerId: 1,
      button: 0,
      clientX: 50,
      clientY: 450,
    })
    fireEvent.pointerMove(grid, { pointerId: 1, clientX: 150, clientY: 450 })
    fireEvent.pointerUp(grid, { pointerId: 1, clientX: 150, clientY: 450 })
    expect(onItemMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "move",
        changes: [
          expect.objectContaining({
            itemId: "drag-me",
            nextRange: expect.objectContaining({ startDate: "2026-07-28" }),
          }),
        ],
      })
    )

    const emptyCell = screen.getByLabelText("Wed, 2026-07-29")
    fireEvent.pointerDown(emptyCell, {
      pointerId: 2,
      button: 0,
      clientX: 250,
      clientY: 450,
    })
    fireEvent.pointerUp(grid, {
      pointerId: 2,
      button: 0,
      clientX: 250,
      clientY: 450,
    })
    expect(onItemCreate).toHaveBeenCalledWith(
      { kind: "all-day", startDate: "2026-07-29", endDate: "2026-07-29" },
      { viewMode: "month", source: "pointer" }
    )
  })

  it("resizes both edges, enforces the minimum range, and creates reverse drag ranges", () => {
    const onItemCreate = vi.fn()
    const onItemMutation = vi.fn()
    const { renderResult } = renderCalendar(<Calendar />, undefined, {
      onItemCreate,
      onItemMutation,
      items: [
        createAllDayItem({
          id: "resize-me",
          startDate: "2026-07-28",
          endDate: "2026-07-28",
        }),
      ],
      preferences: createTestPreferences({ weekStartsOn: 1 }),
    })
    const grid = screen.getByTestId("calendar-month-view")
    grid.getBoundingClientRect = () =>
      ({
        left: 0,
        right: 700,
        top: 0,
        bottom: 500,
        width: 700,
        height: 500,
      }) as DOMRect

    const endHandle = screen.getByLabelText("Resize resize-me end")
    fireEvent.pointerDown(endHandle, {
      pointerId: 3,
      button: 0,
      clientX: 150,
      clientY: 450,
    })
    fireEvent.pointerMove(grid, { pointerId: 3, clientX: 350, clientY: 450 })
    fireEvent.pointerUp(grid, { pointerId: 3, clientX: 350, clientY: 450 })
    expect(onItemMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "resize",
        edge: "end",
        nextRange: expect.objectContaining({ endDate: "2026-07-30" }),
      })
    )

    renderResult.unmount()
    const invalidResize = vi.fn()
    const reverseCreate = vi.fn()
    renderCalendar(<Calendar />, undefined, {
      onItemMutation: invalidResize,
      onItemCreate: reverseCreate,
      items: [createAllDayItem({ id: "minimum" })],
      preferences: createTestPreferences({ weekStartsOn: 1 }),
    })
    const invalidGrid = screen.getByTestId("calendar-month-view")
    invalidGrid.getBoundingClientRect = grid.getBoundingClientRect
    const startHandle = screen.getByLabelText("Resize minimum start")
    fireEvent.pointerDown(startHandle, {
      pointerId: 4,
      button: 0,
      clientX: 50,
      clientY: 450,
    })
    fireEvent.pointerMove(invalidGrid, {
      pointerId: 4,
      clientX: 250,
      clientY: 450,
    })
    fireEvent.pointerUp(invalidGrid, {
      pointerId: 4,
      clientX: 250,
      clientY: 450,
    })
    expect(invalidResize).not.toHaveBeenCalled()

    const origin = screen.getByLabelText("Thu, 2026-07-30")
    fireEvent.pointerDown(origin, {
      pointerId: 5,
      button: 0,
      clientX: 350,
      clientY: 450,
    })
    fireEvent.pointerMove(invalidGrid, {
      pointerId: 5,
      clientX: 150,
      clientY: 450,
    })
    fireEvent.pointerUp(invalidGrid, {
      pointerId: 5,
      clientX: 150,
      clientY: 450,
    })
    expect(reverseCreate).toHaveBeenCalledWith(
      { kind: "all-day", startDate: "2026-07-28", endDate: "2026-07-30" },
      { viewMode: "month", source: "pointer" }
    )
  })

  it("cancels pointer gestures and blocks them in read-only mode", async () => {
    const onItemMutation = vi.fn()
    const { store, renderResult } = renderCalendar(<Calendar />, undefined, {
      onItemMutation,
      items: [createAllDayItem({ id: "cancel-me" })],
      preferences: createTestPreferences({ weekStartsOn: 1 }),
    })
    const grid = screen.getByTestId("calendar-month-view")
    grid.getBoundingClientRect = () =>
      ({
        left: 0,
        right: 700,
        top: 0,
        bottom: 500,
        width: 700,
        height: 500,
      }) as DOMRect
    const event = screen
      .getByTestId("calendar-event-cancel-me")
      .querySelector("button")!
    fireEvent.pointerDown(event, {
      pointerId: 6,
      button: 0,
      clientX: 50,
      clientY: 450,
    })
    fireEvent.pointerMove(grid, { pointerId: 6, clientX: 150, clientY: 450 })
    await waitFor(() =>
      expect(store.getState().interaction.type).toBe("moving")
    )
    fireEvent.pointerCancel(grid, { pointerId: 6 })
    expect(store.getState().interaction.type).toBe("idle")
    expect(onItemMutation).not.toHaveBeenCalled()

    fireEvent.pointerDown(event, {
      pointerId: 7,
      button: 0,
      clientX: 50,
      clientY: 450,
    })
    fireEvent.pointerMove(grid, { pointerId: 7, clientX: 52, clientY: 451 })
    fireEvent.pointerUp(grid, { pointerId: 7, clientX: 52, clientY: 451 })
    expect(onItemMutation).not.toHaveBeenCalled()

    renderResult.unmount()
    const onItemCreate = vi.fn()
    renderCalendar(<Calendar />, undefined, { readOnly: true, onItemCreate })
    const readOnlyGrid = screen.getByTestId("calendar-month-view")
    const cell = screen.getByLabelText("Mon, 2026-07-27")
    fireEvent.pointerDown(cell, { pointerId: 8, button: 0 })
    fireEvent.pointerUp(readOnlyGrid, { pointerId: 8 })
    expect(onItemCreate).not.toHaveBeenCalled()
  })
})
