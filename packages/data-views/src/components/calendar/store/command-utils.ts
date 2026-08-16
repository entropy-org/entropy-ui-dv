import type {
  CalendarCommandExpectation,
  CalendarItem,
  CalendarMutationCommand,
} from "../types.js"
import {
  calendarRangesEqual,
  getCalendarItemRange,
} from "../utils/date-range.js"

export interface CalendarCommandExpectations {
  readonly previous: readonly CalendarCommandExpectation[]
  readonly expected: readonly CalendarCommandExpectation[]
}

export function replaceCalendarMutationId(
  command: CalendarMutationCommand,
  clientMutationId: string
): CalendarMutationCommand {
  return { ...command, clientMutationId }
}

export function invertCalendarMutationCommand(
  command: CalendarMutationCommand,
  clientMutationId: string
): CalendarMutationCommand {
  switch (command.type) {
    case "move":
      return {
        type: "move",
        clientMutationId,
        changes: command.changes.map((change) => ({
          itemId: change.itemId,
          previousRange: change.nextRange,
          nextRange: change.previousRange,
        })),
      }
    case "resize":
      return {
        ...command,
        clientMutationId,
        previousRange: command.nextRange,
        nextRange: command.previousRange,
      }
    case "delete":
      return {
        type: "restore",
        clientMutationId,
        itemIds: command.itemIds,
      }
    case "restore":
      return {
        type: "delete",
        clientMutationId,
        itemIds: command.itemIds,
      }
  }
}

export function getCalendarCommandExpectations(
  command: CalendarMutationCommand
): CalendarCommandExpectations {
  switch (command.type) {
    case "move":
      return {
        previous: command.changes.map((change) => ({
          type: "range" as const,
          itemId: change.itemId,
          range: change.previousRange,
        })),
        expected: command.changes.map((change) => ({
          type: "range" as const,
          itemId: change.itemId,
          range: change.nextRange,
        })),
      }
    case "resize":
      return {
        previous: [
          {
            type: "range",
            itemId: command.itemId,
            range: command.previousRange,
          },
        ],
        expected: [
          {
            type: "range",
            itemId: command.itemId,
            range: command.nextRange,
          },
        ],
      }
    case "delete":
      return {
        previous: command.itemIds.map((itemId) => ({
          type: "present" as const,
          itemId,
        })),
        expected: command.itemIds.map((itemId) => ({
          type: "absent" as const,
          itemId,
        })),
      }
    case "restore":
      return {
        previous: command.itemIds.map((itemId) => ({
          type: "absent" as const,
          itemId,
        })),
        expected: command.itemIds.map((itemId) => ({
          type: "present" as const,
          itemId,
        })),
      }
  }
}

export function createCalendarItemMap(
  items: readonly CalendarItem[]
): ReadonlyMap<string, CalendarItem> {
  return new Map(items.map((item) => [item.id, item]))
}

export function calendarExpectationsMatch(
  items: ReadonlyMap<string, CalendarItem>,
  expectations: readonly CalendarCommandExpectation[]
): boolean {
  return expectations.every((expectation) => {
    const item = items.get(expectation.itemId)
    if (expectation.type === "absent") return item === undefined
    if (expectation.type === "present") return item !== undefined
    return (
      item !== undefined &&
      calendarRangesEqual(getCalendarItemRange(item), expectation.range)
    )
  })
}

export function getCalendarExpectationItemIds(
  expectations: readonly CalendarCommandExpectation[]
): ReadonlySet<string> {
  return new Set(expectations.map((expectation) => expectation.itemId))
}
