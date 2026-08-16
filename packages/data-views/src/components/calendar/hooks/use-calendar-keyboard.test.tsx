import { act, fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Calendar } from "../components/calendar.js"
import { renderCalendar } from "../test/render-calendar.js"
import {
  createMoveCommand,
  createTestPreferences,
} from "../test/fixtures.js"

describe("calendar keyboard commands", () => {
  it("navigates date focus, periods, Today, views, and creation", () => {
    const onAnchorDateChange = vi.fn()
    const onPreferencesChange = vi.fn()
    const onItemCreate = vi.fn()
    const { store } = renderCalendar(<Calendar />, undefined, {
      onAnchorDateChange,
      onPreferencesChange,
      onItemCreate,
      preferences: createTestPreferences({ weekStartsOn: 1 }),
    })
    const root = screen.getByTestId("calendar")
    const cell = screen.getByLabelText("Mon, 2026-07-27")
    fireEvent.focus(cell)

    fireEvent.keyDown(root, { key: "ArrowRight" })
    expect(store.getState().focusedDate).toBe("2026-07-28")
    fireEvent.keyDown(root, { key: "ArrowDown" })
    expect(store.getState().focusedDate).toBe("2026-08-04")
    fireEvent.keyDown(root, { key: "ArrowUp" })
    fireEvent.keyDown(root, { key: "ArrowLeft" })
    expect(store.getState().focusedDate).toBe("2026-07-27")
    fireEvent.keyDown(root, { key: "End" })
    expect(store.getState().focusedDate).toBe("2026-08-02")
    fireEvent.keyDown(root, { key: "Home" })
    expect(store.getState().focusedDate).toBe("2026-07-27")

    fireEvent.keyDown(root, { key: "PageDown" })
    fireEvent.keyDown(root, { key: "PageUp" })
    fireEvent.keyDown(root, { key: "t" })
    expect(onAnchorDateChange).toHaveBeenCalled()
    fireEvent.keyDown(root, { key: "w" })
    fireEvent.keyDown(root, { key: "m" })
    expect(onPreferencesChange).toHaveBeenCalledWith(expect.anything(), {
      type: "view-mode",
      value: "week",
    })

    fireEvent.keyDown(root, { key: "Enter" })
    fireEvent.keyDown(root, { key: " " })
    expect(onItemCreate).toHaveBeenCalledTimes(2)
  })

  it("handles selection, movement, resize, history, and Escape hierarchy", () => {
    const onItemMutation = vi.fn()
    const { store } = renderCalendar(<Calendar />, undefined, {
      onItemMutation,
    })
    const root = screen.getByTestId("calendar")
    const event = screen
      .getByTestId("calendar-event-all-day-1")
      .querySelector("button")!
    fireEvent.click(event)

    fireEvent.keyDown(root, { key: "ArrowRight", altKey: true })
    expect(onItemMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "move" })
    )
    const moveId = onItemMutation.mock.calls.at(-1)?.[0].clientMutationId
    act(() => store.getState().actions.confirmCommand(moveId))

    fireEvent.keyDown(root, { key: "ArrowLeft", altKey: true, shiftKey: true })
    expect(onItemMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "resize", edge: "start" })
    )
    const resizeId = onItemMutation.mock.calls.at(-1)?.[0].clientMutationId
    act(() => store.getState().actions.confirmCommand(resizeId))

    fireEvent.keyDown(root, { key: "z", ctrlKey: true })
    expect(onItemMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "resize" })
    )
    const undoId = onItemMutation.mock.calls.at(-1)?.[0].clientMutationId
    act(() => store.getState().actions.confirmCommand(undoId))
    fireEvent.keyDown(root, { key: "z", ctrlKey: true, shiftKey: true })
    const redoId = onItemMutation.mock.calls.at(-1)?.[0].clientMutationId
    act(() => store.getState().actions.confirmCommand(redoId))
    fireEvent.keyDown(root, { key: "y", ctrlKey: true })

    act(() => store.getState().actions.openOverflow("2026-07-27", "overflow"))
    fireEvent.keyDown(root, { key: "Escape" })
    expect(store.getState().overflow.type).toBe("closed")
    fireEvent.keyDown(root, { key: "Escape" })
    expect(store.getState().selectedIds.size).toBe(0)
  })

  it("skips hidden weekends and ignores shortcuts from editable controls", () => {
    const onAnchorDateChange = vi.fn()
    const { store } = renderCalendar(<Calendar />, undefined, {
      onAnchorDateChange,
      preferences: createTestPreferences({
        showWeekends: false,
        weekStartsOn: 1,
      }),
    })
    const friday = screen.getByLabelText("Fri, 2026-07-31")
    fireEvent.focus(friday)
    fireEvent.keyDown(friday, { key: "ArrowRight" })
    expect(store.getState().focusedDate).toBe("2026-08-03")

    onAnchorDateChange.mockClear()
    const search = screen.getByLabelText("Search calendar")
    fireEvent.keyDown(search, { key: "t" })
    expect(onAnchorDateChange).not.toHaveBeenCalled()
  })

  it("supports select-all and deletion shortcuts", () => {
    const onItemMutation = vi.fn()
    const { store } = renderCalendar(<Calendar />, undefined, {
      onItemMutation,
    })
    const root = screen.getByTestId("calendar")
    fireEvent.keyDown(root, { key: "a", metaKey: true })
    expect(store.getState().selectedIds.size).toBe(2)
    fireEvent.keyDown(root, { key: "Backspace" })
    expect(onItemMutation).toHaveBeenCalledWith(
      expect.objectContaining({ type: "delete" })
    )

    act(() => store.getState().actions.clearHistory())
    act(() => store.getState().actions.recordCommand(createMoveCommand("seed")))
    act(() => store.getState().actions.confirmCommand("seed"))
    fireEvent.keyDown(root, { key: "z", metaKey: true })
    expect(onItemMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "move" })
    )
  })
})
