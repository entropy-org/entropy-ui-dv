import { describe, expect, it } from "vitest"
import { getCalendarCommandExpectations } from "../store/command-utils.js"
import {
  createAllDayItem,
  createMoveCommand,
  createTestPreferences,
} from "../test/fixtures.js"
import type { CalendarPendingCommand } from "../types.js"
import {
  applyPendingCalendarItems,
  buildCalendarRenderModel,
  formatCalendarTitle,
} from "./calendar-model.js"
import { buildWeekGrid } from "./date-grid.js"

describe("calendar render model", () => {
  it("overlays pending ranges and deletions without mutating controlled items", () => {
    const items = [
      createAllDayItem({ id: "all-day-1" }),
      createAllDayItem({ id: "delete-me" }),
    ]
    const move = createMoveCommand()
    const moveExpectations = getCalendarCommandExpectations(move)
    const deletion = {
      type: "delete" as const,
      clientMutationId: "delete-1",
      itemIds: ["delete-me"],
    }
    const deleteExpectations = getCalendarCommandExpectations(deletion)
    const pending: CalendarPendingCommand[] = [
      {
        transactionId: "move-1",
        operation: "record",
        command: move,
        ...moveExpectations,
      },
      {
        transactionId: "delete-1",
        operation: "record",
        command: deletion,
        ...deleteExpectations,
      },
    ]

    expect(applyPendingCalendarItems(items, pending)).toEqual([
      expect.objectContaining({
        id: "all-day-1",
        startDate: "2026-07-28",
      }),
    ])
    expect(items[0].startDate).toBe("2026-07-27")
  })

  it("builds shared month/week models with search and calendar filtering", () => {
    const preferences = createTestPreferences({
      visibleCalendarIds: ["work"],
      maxVisibleLanes: 1,
    })
    const model = buildCalendarRenderModel({
      anchorDate: "2026-07-27",
      items: [
        createAllDayItem({
          id: "launch",
          calendarId: "work",
          data: { title: "Launch" },
        }),
        createAllDayItem({
          id: "personal",
          calendarId: "personal",
          data: { title: "Holiday" },
        }),
      ],
      pendingCommands: [],
      preferences,
      searchQuery: "launch",
    })
    expect(model.items.map(({ id }) => id)).toEqual(["launch"])
    expect(model.grid.rowCount).toBeGreaterThanOrEqual(5)
    expect(model.orderedItemIds).toEqual(["launch"])
    expect(formatCalendarTitle(model.grid, "month", "en-US")).toBe("July 2026")
  })

  it("formats week titles across month and year boundaries", () => {
    const options = {
      weekStartsOn: 1 as const,
      showWeekends: true,
      locale: "en-US",
    }
    expect(
      formatCalendarTitle(buildWeekGrid("2026-07-27", options), "week", "en-US")
    ).toBe("Jul 27 – Aug 2, 2026")
    expect(
      formatCalendarTitle(buildWeekGrid("2026-12-28", options), "week", "en-US")
    ).toBe("Dec 28, 2026 – Jan 3, 2027")
    expect(
      formatCalendarTitle(buildWeekGrid("2026-07-13", options), "week", "en-US")
    ).toBe("Jul 13 – Jul 19, 2026")
  })
})
