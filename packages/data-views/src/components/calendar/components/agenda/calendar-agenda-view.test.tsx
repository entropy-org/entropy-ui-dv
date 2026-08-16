import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Calendar } from "../calendar.js"
import { renderCalendar } from "../../test/render-calendar.js"
import { createAllDayItem, createTestPreferences, createTimedItem } from "../../test/fixtures.js"
import { CALENDAR_NO_VISIBLE_SOURCES } from "../../constants.js"

describe("Calendar agenda view", () => {
  it("renders an interactive empty time grid and hidden-weekend week", () => {
    renderCalendar(<Calendar />, undefined, {
      items: [],
      preferences: createTestPreferences({ viewMode: "agenda", showWeekends: false }),
    })
    expect(screen.getByRole("group", { name: "5-day time grid" })).toBeInTheDocument()
    expect(document.querySelectorAll("[data-calendar-day-header]")).toHaveLength(5)
    expect(screen.queryByTestId("calendar-empty-state")).not.toBeInTheDocument()
  })

  it("renders all-day, overlap, cross-midnight, and current-time geometry", () => {
    renderCalendar(<Calendar />, undefined, {
      preferences: createTestPreferences({ viewMode: "agenda" }),
      items: [
        createAllDayItem({ id: "all" }),
        createTimedItem({ id: "first" }),
        createTimedItem({ id: "second", start: new Date("2026-07-27T16:30:00Z"), end: new Date("2026-07-27T17:30:00Z") }),
        createTimedItem({ id: "cross", start: new Date("2026-07-28T06:30:00Z"), end: new Date("2026-07-28T08:30:00Z") }),
      ],
    })
    expect(document.querySelectorAll("[data-calendar-agenda-event='all']")).toHaveLength(1)
    expect(document.querySelectorAll("[data-calendar-agenda-event='cross']")).toHaveLength(2)
    expect(screen.getByRole("separator", { name: /Current time/ })).toBeInTheDocument()
  })

  it("supports keyboard timed creation, selection, duplicate intent, and read-only", () => {
    const onItemCreate = vi.fn()
    const onItemDuplicate = vi.fn()
    const { renderResult } = renderCalendar(<Calendar />, undefined, {
      preferences: createTestPreferences({ viewMode: "agenda" }),
      onItemCreate,
      onItemDuplicate,
    })
    const grid = screen.getByRole("group", { name: "7-day time grid" })
    fireEvent.focus(grid)
    fireEvent.keyDown(grid, { key: "Enter" })
    expect(onItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "timed" }),
      { viewMode: "agenda", source: "keyboard" }
    )
    fireEvent.click(document.querySelector<HTMLElement>("[data-calendar-agenda-event='timed-1'] button")!)
    fireEvent.keyDown(screen.getByTestId("calendar"), { key: "d", ctrlKey: true })
    expect(onItemDuplicate).toHaveBeenCalledWith([expect.objectContaining({ id: "timed-1" })])

    renderResult.unmount()
    renderCalendar(<Calendar />, undefined, {
      preferences: createTestPreferences({ viewMode: "agenda" }),
      readOnly: true,
    })
    expect(screen.getByTestId("calendar-agenda-grid")).toHaveAttribute("data-read-only", "true")
    expect(screen.queryByLabelText(/Resize .* start/)).not.toBeInTheDocument()
  })

  it("composes the default configured sidebar and controlled source toggles", () => {
    const onPreferencesChange = vi.fn()
    const onAnchorDateChange = vi.fn()
    renderCalendar(<Calendar />, undefined, {
      preferences: createTestPreferences({ viewMode: "agenda" }),
      agenda: {
        sidebar: {
          type: "default",
          resizable: true,
          calendars: [
            { id: "work", label: "Work", color: "red" },
            { id: "disabled", label: "Disabled", disabled: true },
          ],
          renderCalendarSource: (source, state) => `${source.label}:${state.visible}:${state.disabled}`,
        },
      },
      onPreferencesChange,
      onAnchorDateChange,
    })
    const sidebar = screen.getByRole("complementary", { name: "Agenda sidebar" })
    expect(sidebar).toBeInTheDocument()
    expect(screen.getByText("Disabled:true:true")).toBeInTheDocument()
    expect(screen.getByLabelText("Show Disabled")).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(screen.getByLabelText("Show Work"))
    expect(onPreferencesChange).toHaveBeenCalledWith(
      expect.objectContaining({ visibleCalendarIds: [CALENDAR_NO_VISIBLE_SOURCES] }),
      { type: "visible-calendars", value: [CALENDAR_NO_VISIBLE_SOURCES] }
    )
    fireEvent.click(screen.getByLabelText("Previous month"))
    expect(onAnchorDateChange).toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText("Next month"))
    const separator = screen.getByRole("separator", { name: "Resize agenda sidebar" })
    fireEvent.pointerDown(separator, { pointerId: 41, clientX: 220 })
    fireEvent.pointerMove(separator, { pointerId: 41, clientX: 300 })
    fireEvent.pointerUp(separator, { pointerId: 41, clientX: 300 })
    expect(sidebar).toHaveStyle({ width: "312px" })
  })

  it("creates, moves, resizes, and cancels timed pointer gestures", () => {
    const onItemCreate = vi.fn()
    const onItemMutation = vi.fn()
    const { store } = renderCalendar(<Calendar />, undefined, {
      preferences: createTestPreferences({ viewMode: "agenda" }),
      onItemCreate,
      onItemMutation,
      items: [createTimedItem({ id: "drag" })],
    })
    const grid = screen.getByTestId("calendar-agenda-grid")
    grid.getBoundingClientRect = () => ({
      left: 0, right: 700, top: 0, bottom: 1536, width: 700, height: 1536,
      x: 0, y: 0, toJSON: () => ({}),
    }) as DOMRect

    fireEvent.pointerDown(grid, { pointerId: 20, button: 0, clientX: 250, clientY: 640 })
    fireEvent.pointerUp(grid, { pointerId: 20, button: 0, clientX: 250, clientY: 640 })
    expect(onItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "timed" }),
      { viewMode: "agenda", source: "pointer" }
    )

    const eventButton = document.querySelector<HTMLElement>("[data-calendar-agenda-event='drag'] button")!
    fireEvent.pointerDown(eventButton, { pointerId: 21, button: 0, clientX: 50, clientY: 576 })
    fireEvent.pointerMove(grid, { pointerId: 21, clientX: 150, clientY: 640 })
    fireEvent.pointerUp(grid, { pointerId: 21, clientX: 150, clientY: 640 })
    expect(onItemMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "move",
        changes: [expect.objectContaining({ itemId: "drag", nextRange: expect.objectContaining({ kind: "timed" }) })],
      })
    )

    const endHandle = screen.getByLabelText("Resize drag end")
    fireEvent.pointerDown(endHandle, { pointerId: 22, button: 0, clientX: 50, clientY: 640 })
    fireEvent.pointerMove(grid, { pointerId: 22, clientX: 50, clientY: 704 })
    fireEvent.pointerUp(grid, { pointerId: 22, clientX: 50, clientY: 704 })
    expect(onItemMutation).toHaveBeenLastCalledWith(expect.objectContaining({ type: "resize", edge: "end" }))

    fireEvent.pointerDown(eventButton, { pointerId: 23, button: 0, clientX: 50, clientY: 576 })
    fireEvent.pointerMove(grid, { pointerId: 23, clientX: 150, clientY: 576 })
    fireEvent.pointerCancel(grid, { pointerId: 23 })
    expect(store.getState().interaction.type).toBe("idle")
  })

  it("supports timed drag creation previews and all-day movement/resizing", () => {
    const onItemCreate = vi.fn()
    const onItemMutation = vi.fn()
    renderCalendar(<Calendar />, undefined, {
      preferences: createTestPreferences({ viewMode: "agenda" }),
      onItemCreate,
      onItemMutation,
      items: [createAllDayItem({ id: "banner" })],
    })
    const grid = screen.getByTestId("calendar-agenda-grid")
    grid.getBoundingClientRect = () => ({
      left: 0, right: 700, top: 0, bottom: 1536, width: 700, height: 1536,
      x: 0, y: 0, toJSON: () => ({}),
    }) as DOMRect

    fireEvent.pointerDown(grid, { pointerId: 30, button: 0, clientX: 50, clientY: 576 })
    fireEvent.pointerMove(grid, { pointerId: 30, clientX: 150, clientY: 704 })
    fireEvent.pointerUp(grid, { pointerId: 30, clientX: 150, clientY: 704 })
    expect(onItemCreate).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "timed" }), expect.anything())

    const banner = document.querySelector<HTMLElement>("[data-calendar-agenda-event='banner'] button")!
    fireEvent.pointerDown(banner, { pointerId: 31, button: 0, clientX: 50, clientY: 0 })
    fireEvent.pointerMove(grid, { pointerId: 31, clientX: 150, clientY: 0 })
    fireEvent.pointerUp(grid, { pointerId: 31, clientX: 150, clientY: 0 })
    expect(onItemMutation).toHaveBeenLastCalledWith(expect.objectContaining({ type: "move" }))

    const allDayEnd = screen.getByLabelText("Resize banner end")
    fireEvent.pointerDown(allDayEnd, { pointerId: 32, button: 0, clientX: 50, clientY: 0 })
    fireEvent.pointerMove(grid, { pointerId: 32, clientX: 250, clientY: 0 })
    fireEvent.pointerUp(grid, { pointerId: 32, clientX: 250, clientY: 0 })
    expect(onItemMutation).toHaveBeenLastCalledWith(expect.objectContaining({ type: "resize", edge: "end" }))
  })

  it("provides agenda grid keyboard navigation, movement, resize, and conversion", () => {
    const onItemMutation = vi.fn()
    const onItemConvert = vi.fn()
    renderCalendar(<Calendar />, undefined, {
      preferences: createTestPreferences({ viewMode: "agenda" }),
      onItemMutation,
      onItemConvert,
      items: [createTimedItem({ id: "keys" }), createAllDayItem({ id: "convert" })],
    })
    const grid = screen.getByTestId("calendar-agenda-grid")
    fireEvent.focus(grid)
    for (const key of ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "ArrowRight", "ArrowLeft", "Home", "End"]) {
      fireEvent.keyDown(grid, { key })
    }
    fireEvent.keyDown(grid, { key: "Home", ctrlKey: true })
    fireEvent.keyDown(grid, { key: "End", ctrlKey: true })

    fireEvent.click(document.querySelector<HTMLElement>("[data-calendar-agenda-event='keys'] button")!)
    fireEvent.keyDown(grid, { key: "ArrowDown", altKey: true })
    fireEvent.keyDown(grid, { key: "ArrowRight", altKey: true })
    expect(onItemMutation).toHaveBeenCalledWith(expect.objectContaining({ type: "move" }))
    fireEvent.keyDown(screen.getByLabelText("Resize keys end"), { key: "ArrowDown" })
    fireEvent.keyDown(screen.getByLabelText("Resize keys start"), { key: "ArrowUp" })
    expect(onItemMutation).toHaveBeenCalledWith(expect.objectContaining({ type: "resize" }))

    fireEvent.click(document.querySelector<HTMLElement>("[data-calendar-agenda-event='convert'] button")!)
    fireEvent.keyDown(screen.getByTestId("calendar"), { key: "C", shiftKey: true })
    expect(onItemConvert).toHaveBeenCalledWith(expect.objectContaining({ id: "convert" }), expect.objectContaining({ kind: "timed" }))
  })

  it("supports custom sidebar composition, collapse, reopen, and configured renderers", () => {
    const custom = vi.fn(() => <p>Custom sidebar content</p>)
    const onItemDoubleClick = vi.fn()
    renderCalendar(<Calendar />, undefined, {
      preferences: createTestPreferences({
        viewMode: "agenda",
        agenda: { ...createTestPreferences().agenda, span: { type: "day" }, showAllDaySection: false },
      }),
      agenda: {
        sidebar: { type: "custom", render: custom, resizable: true },
        renderTimedItem: () => <span>Custom timed item</span>,
        renderDayHeader: (date) => <span>Header {date}</span>,
        renderTimeLabel: (minutes) => <span>T{minutes}</span>,
      },
      onItemDoubleClick,
    })
    expect(screen.getByText("Custom sidebar content")).toBeInTheDocument()
    expect(screen.getByText("Custom timed item")).toBeInTheDocument()
    expect(screen.getByText(/Header 2026-07-27/)).toBeInTheDocument()
    expect(screen.getByText("T0")).toBeInTheDocument()
    fireEvent.doubleClick(document.querySelector<HTMLElement>("[data-calendar-agenda-event='timed-1'] button")!)
    expect(onItemDoubleClick).toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText("Close agenda sidebar"))
    expect(screen.queryByText("Custom sidebar content")).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Open agenda sidebar"))
    expect(screen.getByText("Custom sidebar content")).toBeInTheDocument()
  })

  it("navigates after horizontal edge dwell during a gesture", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
    })
    try {
      const onAnchorDateChange = vi.fn()
      renderCalendar(<Calendar />, undefined, {
        preferences: createTestPreferences({ viewMode: "agenda" }),
        onAnchorDateChange,
        onItemCreate: vi.fn(),
      })
      const grid = screen.getByTestId("calendar-agenda-grid")
      grid.getBoundingClientRect = () => ({
        left: 0, right: 700, top: 0, bottom: 1536, width: 700, height: 1536,
        x: 0, y: 0, toJSON: () => ({}),
      }) as DOMRect
      fireEvent.pointerDown(grid, { pointerId: 50, button: 0, clientX: 350, clientY: 576 })
      fireEvent.pointerMove(grid, { pointerId: 50, clientX: 695, clientY: 576 })
      vi.advanceTimersByTime(600)
      expect(onAnchorDateChange).toHaveBeenCalled()
      fireEvent.pointerCancel(grid, { pointerId: 50 })
    } finally {
      vi.useRealTimers()
    }
  })
})
