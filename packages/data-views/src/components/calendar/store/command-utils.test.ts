import { describe, expect, it } from "vitest"
import {
  calendarExpectationsMatch,
  createCalendarItemMap,
  getCalendarCommandExpectations,
  invertCalendarMutationCommand,
  replaceCalendarMutationId,
} from "./command-utils.js"
import {
  createAllDayItem,
  createMoveCommand,
} from "../test/fixtures.js"
import type { CalendarMutationCommand } from "../types.js"

describe("calendar command utilities", () => {
  it("inverts move, resize, delete, and restore commands", () => {
    const move = createMoveCommand()
    expect(invertCalendarMutationCommand(move, "undo-move")).toEqual({
      type: "move",
      clientMutationId: "undo-move",
      changes: [
        {
          itemId: "all-day-1",
          previousRange: move.changes[0].nextRange,
          nextRange: move.changes[0].previousRange,
        },
      ],
    })

    const resize: CalendarMutationCommand = {
      type: "resize",
      clientMutationId: "resize-1",
      itemId: "all-day-1",
      edge: "end",
      previousRange: move.changes[0].previousRange,
      nextRange: move.changes[0].nextRange,
    }
    expect(invertCalendarMutationCommand(resize, "undo-resize")).toEqual({
      ...resize,
      clientMutationId: "undo-resize",
      previousRange: resize.nextRange,
      nextRange: resize.previousRange,
    })
    expect(
      invertCalendarMutationCommand(
        { type: "delete", clientMutationId: "delete-1", itemIds: ["a"] },
        "restore-1"
      )
    ).toEqual({
      type: "restore",
      clientMutationId: "restore-1",
      itemIds: ["a"],
    })
    expect(
      invertCalendarMutationCommand(
        { type: "restore", clientMutationId: "restore-1", itemIds: ["a"] },
        "delete-2"
      )
    ).toEqual({
      type: "delete",
      clientMutationId: "delete-2",
      itemIds: ["a"],
    })
  })

  it("derives before/after expectations without storing item snapshots", () => {
    const command = createMoveCommand()
    const expectations = getCalendarCommandExpectations(command)
    expect(expectations.previous[0]).toEqual({
      type: "range",
      itemId: "all-day-1",
      range: command.changes[0].previousRange,
    })
    expect(expectations.expected[0]).toEqual({
      type: "range",
      itemId: "all-day-1",
      range: command.changes[0].nextRange,
    })

    const itemMap = createCalendarItemMap([
      createAllDayItem({
        id: "all-day-1",
        startDate: "2026-07-28",
        endDate: "2026-07-28",
      }),
    ])
    expect(calendarExpectationsMatch(itemMap, expectations.expected)).toBe(true)
    expect(calendarExpectationsMatch(itemMap, expectations.previous)).toBe(
      false
    )

    expect(
      getCalendarCommandExpectations({
        type: "restore",
        clientMutationId: "restore-1",
        itemIds: ["all-day-1"],
      })
    ).toEqual({
      previous: [{ type: "absent", itemId: "all-day-1" }],
      expected: [{ type: "present", itemId: "all-day-1" }],
    })
  })

  it("replaces only the emitted mutation ID for redo", () => {
    const command = createMoveCommand()
    expect(replaceCalendarMutationId(command, "redo-1")).toEqual({
      ...command,
      clientMutationId: "redo-1",
    })
    expect(command.clientMutationId).toBe("move-1")
  })
})
