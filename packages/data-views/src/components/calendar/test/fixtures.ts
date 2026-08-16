import { createDefaultCalendarPreferences } from "../constants.js"
import type {
  AllDayCalendarItem,
  CalendarConfig,
  CalendarItem,
  CalendarMutationCommand,
  CalendarPreferences,
  TimedCalendarItem,
} from "../types.js"

export const TEST_NOW = new Date("2026-07-27T16:00:00.000Z")
export const TEST_ANCHOR_DATE = "2026-07-27"

export function createTestPreferences(
  overrides: Partial<CalendarPreferences> = {}
): CalendarPreferences {
  return {
    ...createDefaultCalendarPreferences("America/Los_Angeles"),
    ...overrides,
  }
}

export function createAllDayItem(
  overrides: Partial<AllDayCalendarItem> & { id: string }
): AllDayCalendarItem {
  return {
    kind: "all-day",
    startDate: "2026-07-27",
    endDate: "2026-07-27",
    data: { title: `Item ${overrides.id}` },
    ...overrides,
  }
}

export function createTimedItem(
  overrides: Partial<TimedCalendarItem> & { id: string }
): TimedCalendarItem {
  return {
    kind: "timed",
    start: new Date("2026-07-27T16:00:00.000Z"),
    end: new Date("2026-07-27T17:00:00.000Z"),
    data: { title: `Item ${overrides.id}` },
    ...overrides,
  }
}

export function createTestItems(): CalendarItem[] {
  return [
    createAllDayItem({ id: "all-day-1" }),
    createTimedItem({ id: "timed-1" }),
  ]
}

export function createMoveCommand(
  clientMutationId = "move-1",
  itemId = "all-day-1"
): Extract<CalendarMutationCommand, { readonly type: "move" }> {
  return {
    type: "move",
    clientMutationId,
    changes: [
      {
        itemId,
        previousRange: {
          kind: "all-day",
          startDate: "2026-07-27",
          endDate: "2026-07-27",
        },
        nextRange: {
          kind: "all-day",
          startDate: "2026-07-28",
          endDate: "2026-07-28",
        },
      },
    ],
  }
}

export function createTestConfig(
  overrides: Partial<CalendarConfig> = {}
): CalendarConfig {
  return {
    items: createTestItems(),
    preferences: createTestPreferences(),
    initialAnchorDate: TEST_ANCHOR_DATE,
    now: () => TEST_NOW,
    renderItem: (item) => item.id,
    ...overrides,
  }
}
