import { describe, expect, it } from "vitest"
import { MAX_CALENDAR_HISTORY_ENTRIES } from "../../constants.js"
import { createCalendarStore } from "../create-store.js"
import {
  createAllDayItem,
  createMoveCommand,
  TEST_ANCHOR_DATE,
} from "../../test/fixtures.js"
import type { CalendarMutationCommand } from "../../types.js"

function createStore() {
  return createCalendarStore({ initialAnchorDate: TEST_ANCHOR_DATE })
}

function createDeleteCommand(
  clientMutationId = "delete-1"
): CalendarMutationCommand {
  return { type: "delete", clientMutationId, itemIds: ["all-day-1"] }
}

describe("calendar history slice", () => {
  it("records, confirms, undoes with an inverse, and redoes the original", () => {
    const store = createStore()
    const original = createMoveCommand()
    const { actions } = store.getState()

    expect(actions.recordCommand(original)).toBe(true)
    expect(actions.recordCommand(original)).toBe(false)
    expect(actions.confirmCommand("missing")).toBe(false)
    expect(store.getState().pendingCommands[0].expected[0]).toEqual({
      type: "range",
      itemId: "all-day-1",
      range: original.changes[0].nextRange,
    })
    expect(actions.takeUndoCommand("undo-1")).toBeNull()
    expect(actions.confirmCommand("move-1")).toBe(true)

    const undo = actions.takeUndoCommand("undo-1")
    expect(undo).toEqual({
      type: "move",
      clientMutationId: "undo-1",
      changes: [
        {
          itemId: "all-day-1",
          previousRange: original.changes[0].nextRange,
          nextRange: original.changes[0].previousRange,
        },
      ],
    })
    expect(store.getState().redoStack).toHaveLength(1)
    expect(actions.confirmCommand("undo-1")).toBe(true)

    const redo = actions.takeRedoCommand("redo-1")
    expect(redo).toEqual({ ...original, clientMutationId: "redo-1" })
    expect(store.getState().undoStack).toHaveLength(1)
    expect(store.getState().redoStack).toEqual([])
  })

  it("clears redo when a new transaction is recorded", () => {
    const store = createStore()
    const { actions } = store.getState()
    actions.recordCommand(createMoveCommand("first"))
    actions.confirmCommand("first")
    actions.takeUndoCommand("undo-first")
    actions.confirmCommand("undo-first")
    expect(store.getState().redoStack).toHaveLength(1)

    expect(actions.recordCommand(createMoveCommand("second"))).toBe(true)
    expect(store.getState().redoStack).toEqual([])
  })

  it("rejects malformed commands and bounds transaction metadata", () => {
    const store = createStore()
    const { actions } = store.getState()
    expect(actions.recordCommand(createMoveCommand(""))).toBe(false)
    expect(
      actions.recordCommand({
        type: "delete",
        clientMutationId: "empty-delete",
        itemIds: [],
      })
    ).toBe(false)
    expect(
      actions.recordCommand({
        type: "resize",
        clientMutationId: "invalid-range",
        itemId: "all-day-1",
        edge: "end",
        previousRange: {
          kind: "all-day",
          startDate: "2026-07-27",
          endDate: "2026-07-27",
        },
        nextRange: {
          kind: "all-day",
          startDate: "2026-07-29",
          endDate: "2026-07-28",
        },
      })
    ).toBe(false)

    for (let index = 0; index < MAX_CALENDAR_HISTORY_ENTRIES + 3; index += 1) {
      actions.recordCommand(createMoveCommand(`move-${index}`))
    }
    expect(store.getState().undoStack).toHaveLength(
      MAX_CALENDAR_HISTORY_ENTRIES
    )
    expect(store.getState().undoStack[0].transactionId).toBe("move-3")
    expect(store.getState().pendingCommands).toHaveLength(
      MAX_CALENDAR_HISTORY_ENTRIES
    )
  })

  it("invalidates a rejected transaction and every unsafe later branch", () => {
    const store = createStore()
    const { actions } = store.getState()
    actions.recordCommand(createMoveCommand("first"))
    actions.recordCommand(createMoveCommand("rejected"))
    actions.recordCommand(createMoveCommand("after"))

    expect(actions.rejectCommand("rejected")).toEqual({
      clientMutationId: "rejected",
      reason: "consumer-rejected",
      message: undefined,
    })
    expect(
      store.getState().undoStack.map(({ transactionId }) => transactionId)
    ).toEqual(["first"])
    expect(
      store.getState().pendingCommands.map(({ transactionId }) => transactionId)
    ).toEqual(["first"])
    expect(store.getState().redoStack).toEqual([])
  })

  it("confirms expected controlled ranges and rejects conflicts", () => {
    const confirmedStore = createStore()
    confirmedStore.getState().actions.recordCommand(createMoveCommand())
    expect(
      confirmedStore.getState().actions.reconcileAuthoritativeItems([
        createAllDayItem({
          id: "all-day-1",
          startDate: "2026-07-28",
          endDate: "2026-07-28",
        }),
      ])
    ).toEqual([])
    expect(confirmedStore.getState().pendingCommands).toEqual([])

    const conflictStore = createStore()
    conflictStore.getState().actions.recordCommand(createMoveCommand())
    const rejections = conflictStore
      .getState()
      .actions.reconcileAuthoritativeItems([
        createAllDayItem({
          id: "all-day-1",
          startDate: "2026-07-30",
          endDate: "2026-07-30",
        }),
      ])
    expect(rejections).toEqual([
      expect.objectContaining({
        clientMutationId: "move-1",
        reason: "authoritative-conflict",
      }),
    ])
    expect(conflictStore.getState().undoStack).toEqual([])
  })

  it("keeps unchanged authoritative data pending and accepts a batched later result", () => {
    const store = createStore()
    const { actions } = store.getState()
    actions.recordCommand(createMoveCommand("first"))
    expect(
      actions.reconcileAuthoritativeItems([
        createAllDayItem({ id: "all-day-1" }),
      ])
    ).toEqual([])
    expect(store.getState().pendingCommands).toHaveLength(1)

    const second: ReturnType<typeof createMoveCommand> = {
      type: "move",
      clientMutationId: "second",
      changes: [
        {
          itemId: "all-day-1",
          previousRange: {
            kind: "all-day",
            startDate: "2026-07-28",
            endDate: "2026-07-28",
          },
          nextRange: {
            kind: "all-day",
            startDate: "2026-07-29",
            endDate: "2026-07-29",
          },
        },
      ],
    }
    actions.recordCommand(second)
    expect(
      actions.reconcileAuthoritativeItems([
        createAllDayItem({
          id: "all-day-1",
          startDate: "2026-07-29",
          endDate: "2026-07-29",
        }),
      ])
    ).toEqual([])
    expect(store.getState().pendingCommands).toEqual([])
    expect(store.getState().undoStack).toHaveLength(2)
  })

  it("reconciles delete and restore by authoritative presence", () => {
    const store = createStore()
    const { actions } = store.getState()
    actions.recordCommand(createDeleteCommand())

    actions.reconcileAuthoritativeItems([createAllDayItem({ id: "all-day-1" })])
    expect(store.getState().pendingCommands).toHaveLength(1)
    actions.reconcileAuthoritativeItems([])
    expect(store.getState().pendingCommands).toEqual([])

    expect(actions.takeUndoCommand("restore-1")?.type).toBe("restore")
    actions.reconcileAuthoritativeItems([])
    expect(store.getState().pendingCommands).toHaveLength(1)
    actions.reconcileAuthoritativeItems([createAllDayItem({ id: "all-day-1" })])
    expect(store.getState().pendingCommands).toEqual([])
  })

  it("rolls back rejected undo and redo journal movement", () => {
    const store = createStore()
    const { actions } = store.getState()
    actions.recordCommand(createMoveCommand())
    actions.confirmCommand("move-1")

    actions.takeUndoCommand("undo-rejected")
    expect(store.getState().undoStack).toEqual([])
    actions.rejectCommand("undo-rejected")
    expect(store.getState().undoStack).toHaveLength(1)
    expect(store.getState().redoStack).toEqual([])

    actions.takeUndoCommand("undo-accepted")
    actions.confirmCommand("undo-accepted")
    actions.takeRedoCommand("redo-rejected")
    expect(store.getState().redoStack).toEqual([])
    actions.rejectCommand("redo-rejected")
    expect(store.getState().undoStack).toEqual([])
    expect(store.getState().redoStack).toHaveLength(1)
  })

  it("clears all bounded command metadata", () => {
    const store = createStore()
    const { actions } = store.getState()
    expect(actions.takeRedoCommand("redo-missing")).toBeNull()
    actions.recordCommand(createMoveCommand())
    actions.clearHistory()
    expect(store.getState().undoStack).toEqual([])
    expect(store.getState().redoStack).toEqual([])
    expect(store.getState().pendingCommands).toEqual([])
  })
})
