import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Calendar } from "./calendar.js"
import { CalendarEvent } from "./calendar-event.js"
import { CalendarRenderErrorBoundary } from "./calendar-render-error-boundary.js"
import { createCalendarStore } from "../store/create-store.js"
import {
  createAllDayItem,
  createTestPreferences,
} from "../test/fixtures.js"
import { renderCalendar } from "../test/render-calendar.js"
import type { CalendarItem } from "../types.js"
import { buildCalendarRenderModel } from "../utils/calendar-model.js"

describe("calendar accessibility and resilience", () => {
  it("exposes a labeled grid, one roving date stop, current date, and labeled event controls", () => {
    renderCalendar(<Calendar aria-label="Team schedule" />, undefined, {
      items: [createAllDayItem({ id: "launch" })],
      getItemAriaLabel: () => "Launch review",
    })

    expect(screen.getByRole("region", { name: "Team schedule" })).toBeVisible()
    const grid = screen.getByRole("grid", { name: /July 2026 month view/ })
    expect(grid).toHaveAttribute("aria-rowcount", "5")
    expect(grid).toHaveAttribute("aria-colcount", "7")
    expect(screen.getByRole("gridcell", { current: "date" })).toBeVisible()
    expect(
      screen
        .getAllByRole("gridcell")
        .filter((cell) => cell.getAttribute("tabindex") === "0")
    ).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Launch review" })).toBeVisible()
    expect(screen.getByLabelText("Resize launch start")).toBeVisible()
    expect(screen.getByLabelText("Resize launch end")).toBeVisible()
  })

  it("announces selection and supports keyboard resizing from either handle", () => {
    const onItemMutation = vi.fn()
    const { store } = renderCalendar(<Calendar />, undefined, {
      items: [
        createAllDayItem({
          id: "resizable",
          startDate: "2026-07-27",
          endDate: "2026-07-29",
        }),
      ],
      getItemAriaLabel: () => "Resizable event",
      onItemMutation,
    })

    fireEvent.click(screen.getByRole("button", { name: "Resizable event" }))
    expect(store.getState().announcement).toBe("Selected Resizable event.")
    fireEvent.keyDown(screen.getByLabelText("Resize resizable start"), {
      key: "ArrowRight",
    })
    expect(onItemMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "resize",
        edge: "start",
        nextRange: expect.objectContaining({ startDate: "2026-07-28" }),
      })
    )
    expect(store.getState().announcement).toBe("Resized 1 calendar item.")
  })

  it("contains consumer renderer failures and invokes the error callback", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const onRenderError = vi.fn()
    renderCalendar(<Calendar />, undefined, {
      items: [createAllDayItem({ id: "broken" })],
      renderItem: () => {
        throw new Error("broken renderer")
      },
      onRenderError,
    })

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Calendar could not be displayed"
    )
    expect(onRenderError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "broken renderer" })
    )
    error.mockRestore()
  })

  it("supports custom renderer recovery and resets when the recovery key changes", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    let shouldThrow = true
    const MaybeBroken = () => {
      if (shouldThrow) throw new Error("custom failure")
      return <p>Recovered calendar</p>
    }
    const { rerender } = render(
      <CalendarRenderErrorBoundary
        resetKey="first"
        renderFallback={(_, reset) => (
          <button
            type="button"
            onClick={() => {
              shouldThrow = false
              reset()
            }}
          >
            Recover custom calendar
          </button>
        )}
      >
        <MaybeBroken />
      </CalendarRenderErrorBoundary>
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Recover custom calendar" })
    )
    expect(screen.getByText("Recovered calendar")).toBeVisible()

    shouldThrow = true
    rerender(
      <CalendarRenderErrorBoundary resetKey="first">
        <MaybeBroken />
      </CalendarRenderErrorBoundary>
    )
    expect(screen.getByRole("alert")).toBeVisible()
    shouldThrow = false
    rerender(
      <CalendarRenderErrorBoundary resetKey="second">
        <MaybeBroken />
      </CalendarRenderErrorBoundary>
    )
    expect(screen.getByText("Recovered calendar")).toBeVisible()
    error.mockRestore()
  })

  it("moves either focused resize handle in both directions", () => {
    const item = createAllDayItem({ id: "handle" })
    const onResizeKeyDown = vi.fn()
    render(
      <CalendarEvent
        item={item}
        date={item.startDate}
        renderState={{
          isSelected: false,
          isHovered: false,
          interaction: { type: "idle" },
        }}
        content="Handle event"
        ariaLabel="Handle event"
        isRangeStart
        isRangeEnd
        continuedBefore={false}
        continuedAfter={false}
        readOnly={false}
        onItemClick={vi.fn()}
        onItemDoubleClick={vi.fn()}
        onItemPointerDown={vi.fn()}
        onResizePointerDown={vi.fn()}
        onResizeKeyDown={onResizeKeyDown}
      />
    )
    const start = screen.getByLabelText("Resize handle start")
    const end = screen.getByLabelText("Resize handle end")
    fireEvent.keyDown(start, { key: "Tab" })
    fireEvent.keyDown(start, { key: "ArrowLeft" })
    fireEvent.keyDown(start, { key: "ArrowRight" })
    fireEvent.keyDown(end, { key: "Tab" })
    fireEvent.keyDown(end, { key: "ArrowLeft" })
    fireEvent.keyDown(end, { key: "ArrowRight" })
    expect(onResizeKeyDown.mock.calls).toEqual([
      ["start", -1],
      ["start", 1],
      ["end", -1],
      ["end", 1],
    ])
  })

  it("announces unavailable delete, undo, redo, and create actions", () => {
    const { store } = renderCalendar(<Calendar />, undefined, {
      onItemMutation: vi.fn(),
      onItemCreate: undefined,
    })
    const root = screen.getByTestId("calendar")
    fireEvent.keyDown(root, { key: "Delete" })
    expect(store.getState().announcement).toBe(
      "Select an item before deleting."
    )
    fireEvent.keyDown(root, { key: "z", ctrlKey: true })
    expect(store.getState().announcement).toBe(
      "There is no calendar change to undo."
    )
    fireEvent.keyDown(root, { key: "y", ctrlKey: true })
    expect(store.getState().announcement).toBe(
      "There is no calendar change to redo."
    )

    const cell = screen.getByLabelText("Mon, 2026-07-27")
    fireEvent.pointerDown(cell, { pointerId: 81, button: 0 })
    fireEvent.pointerUp(screen.getByRole("grid"), {
      pointerId: 81,
      button: 0,
    })
    expect(store.getState().announcement).toBe(
      "Calendar item creation is unavailable."
    )
  })

  it("forwards root refs and announces overflow open, close, and selection", () => {
    const callbackRef = vi.fn()
    const onItemClick = vi.fn()
    const items = Array.from({ length: 5 }, (_, index) =>
      createAllDayItem({ id: `overflow-${index}` })
    )
    const { store } = renderCalendar(
      <Calendar ref={callbackRef} />,
      undefined,
      {
        items,
        preferences: createTestPreferences({ maxVisibleLanes: 1 }),
        onItemClick,
      }
    )
    expect(callbackRef).toHaveBeenCalledWith(expect.any(HTMLDivElement))
    const trigger = screen.getByLabelText(/4 more events/)
    fireEvent.click(trigger)
    expect(store.getState().overflow.type).toBe("open")
    expect(store.getState().announcement).toContain(
      "4 overflow calendar items opened"
    )
    fireEvent.click(screen.getByRole("button", { name: "overflow-1" }))
    expect(onItemClick).toHaveBeenCalled()
    expect(store.getState().overflow.type).toBe("closed")

    fireEvent.click(trigger)
    fireEvent.click(trigger)
    expect(store.getState().announcement).toBe(
      "Overflow calendar items closed."
    )
  })

  it("contains horizontal overflow below the documented desktop minimum", () => {
    renderCalendar(<Calendar />)
    const root = screen.getByTestId("calendar")
    expect(root).toHaveClass("min-w-0", "overflow-x-auto")
    expect(
      root.firstElementChild?.nextElementSibling?.nextElementSibling
    ).toHaveClass("min-w-[960px]")
  })
})

describe("calendar performance boundaries", () => {
  it("filters offscreen records before layout and bounds the dense event DOM", () => {
    const offscreen: CalendarItem[] = Array.from({ length: 1000 }, (_, index) =>
      createAllDayItem({
        id: `offscreen-${index}`,
        startDate: "2030-01-01",
        endDate: "2030-01-01",
      })
    )
    const model = buildCalendarRenderModel({
      anchorDate: "2026-07-27",
      items: [...offscreen, createAllDayItem({ id: "visible" })],
      pendingCommands: [],
      preferences: createTestPreferences({ maxVisibleLanes: 4 }),
      searchQuery: "",
    })
    expect(model.normalized.items).toHaveLength(1001)
    expect(model.lanes.placements).toHaveLength(1)

    const dense = Array.from({ length: 1000 }, (_, index) =>
      createAllDayItem({ id: `dense-${index}` })
    )
    const { renderResult } = renderCalendar(<Calendar />, undefined, {
      items: dense,
      preferences: createTestPreferences({ maxVisibleLanes: 4 }),
    })
    expect(
      renderResult.container.querySelectorAll(
        "[data-testid^='calendar-event-']"
      )
    ).toHaveLength(4)
    expect(screen.getByLabelText(/996 more events/)).toBeVisible()
  })

  it("does not rerun unrelated item renderers when hover changes", () => {
    const renderItem = vi.fn((item: CalendarItem) => item.id)
    renderCalendar(<Calendar />, undefined, {
      items: [
        createAllDayItem({ id: "hovered" }),
        createAllDayItem({
          id: "unrelated",
          startDate: "2026-07-28",
          endDate: "2026-07-28",
        }),
      ],
      renderItem,
    })
    renderItem.mockClear()

    fireEvent.mouseEnter(screen.getByTestId("calendar-event-hovered"))
    expect(renderItem.mock.calls.map(([item]) => item.id)).toEqual(["hovered"])

    fireEvent.mouseLeave(screen.getByTestId("calendar-event-hovered"))
    renderItem.mockClear()
    const grid = screen.getByRole("grid")
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
      .getByTestId("calendar-event-hovered")
      .querySelector("button")!
    fireEvent.pointerDown(event, {
      pointerId: 91,
      button: 0,
      clientX: 50,
      clientY: 450,
    })
    fireEvent.pointerMove(grid, {
      pointerId: 91,
      clientX: 150,
      clientY: 450,
    })
    expect(
      renderItem.mock.calls.filter(([item]) => item.id === "unrelated")
    ).toHaveLength(0)
    fireEvent.pointerCancel(grid, { pointerId: 91 })
  })

  it("disconnects the root measurement observer after unmount", () => {
    const disconnect = vi.fn()
    const OriginalResizeObserver = globalThis.ResizeObserver
    class TrackingResizeObserver {
      observe() {}
      unobserve() {}
      disconnect = disconnect
    }
    Object.defineProperty(globalThis, "ResizeObserver", {
      value: TrackingResizeObserver,
      configurable: true,
    })
    const { renderResult } = renderCalendar(<Calendar />)
    renderResult.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
    Object.defineProperty(globalThis, "ResizeObserver", {
      value: OriginalResizeObserver,
      configurable: true,
    })
  })

  it("keeps announcements repeatable without object selectors", () => {
    const store = createCalendarStore({ initialAnchorDate: "2026-07-27" })
    store.getState().actions.announce("Updated.")
    store.getState().actions.announce("Updated.")
    expect(store.getState()).toMatchObject({
      announcement: "Updated.",
      announcementSequence: 2,
    })
  })
})
