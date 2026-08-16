import { act } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  useCalendarViewportDimensions,
  useSelectedCalendarIds,
} from "../hooks/use-calendar-selectors.js"
import { createCalendarStore } from "./create-store.js"
import {
  selectActions,
  selectAnchorDate,
  selectCanRedo,
  selectCanUndo,
  selectFocusedDate,
  selectInteraction,
  selectIsCommandPending,
  selectIsSelected,
  selectLatestUndoCommand,
  selectOverflow,
  selectPendingCommands,
  selectPendingItemExpectation,
  selectSearchQuery,
  selectSelectedCount,
  selectSelectedIds,
  selectSettingsOpen,
  selectViewportDimensions,
} from "./selectors.js"
import {
  createMoveCommand,
  TEST_ANCHOR_DATE,
} from "../test/fixtures.js"
import { renderCalendarHook } from "../test/render-calendar.js"

describe("calendar store selectors", () => {
  it("selects primitive and keyed state without exposing server data", () => {
    const store = createCalendarStore({
      initialAnchorDate: TEST_ANCHOR_DATE,
    })
    const { actions } = store.getState()

    actions.setFocusedDate("2026-07-28")
    actions.replaceSelection(["item-1"], "item-1")
    actions.setSearchQuery("launch")
    actions.setSettingsOpen(true)
    actions.openOverflow("2026-07-28", "more")
    actions.recordCommand(createMoveCommand())

    const state = store.getState()
    expect(selectAnchorDate(state)).toBe(TEST_ANCHOR_DATE)
    expect(selectFocusedDate(state)).toBe("2026-07-28")
    expect(selectInteraction(state)).toEqual({ type: "idle" })
    expect(selectSearchQuery(state)).toBe("launch")
    expect(selectOverflow(state)).toEqual({
      type: "open",
      date: "2026-07-28",
      triggerId: "more",
    })
    expect(selectSettingsOpen(state)).toBe(true)
    expect(selectSelectedCount(state)).toBe(1)
    expect(selectIsSelected("item-1")(state)).toBe(true)
    expect(selectIsSelected("item-2")(state)).toBe(false)
    expect(selectSelectedIds(state)).toEqual(["item-1"])
    expect(selectViewportDimensions(state)).toEqual({ width: 0, height: 0 })
    expect(selectPendingCommands(state)).toHaveLength(1)
    expect(selectPendingItemExpectation("all-day-1")(state)).toEqual({
      type: "range",
      itemId: "all-day-1",
      range: {
        kind: "all-day",
        startDate: "2026-07-28",
        endDate: "2026-07-28",
      },
    })
    expect(selectPendingItemExpectation("missing")(state)).toBeUndefined()
    expect(selectCanUndo(state)).toBe(false)
    expect(selectCanRedo(state)).toBe(false)
    expect(selectIsCommandPending("move-1")(state)).toBe(true)
    expect(selectLatestUndoCommand(state)?.clientMutationId).toBe("move-1")
    expect(selectActions(state)).toBe(actions)

    actions.confirmCommand("move-1")
    expect(selectCanUndo(store.getState())).toBe(true)
  })

  it("shallow-selects derived arrays and objects across unrelated updates", () => {
    const selection = renderCalendarHook(useSelectedCalendarIds)
    const initialSelection = selection.result.current
    act(() => selection.store.getState().actions.setSettingsOpen(true))
    expect(selection.result.current).toBe(initialSelection)

    const dimensions = renderCalendarHook(useCalendarViewportDimensions)
    const initialDimensions = dimensions.result.current
    act(() => dimensions.store.getState().actions.setSearchQuery("launch"))
    expect(dimensions.result.current).toBe(initialDimensions)
  })
})
