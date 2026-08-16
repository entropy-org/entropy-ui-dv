/**
 * Test fixtures for the Timeline component test suite.
 *
 * Provides sample TimelineItem and TimelineDependency generators
 * for use across all test files.
 */
import type {
  TimelineItem,
  TimelineDependency,
} from "../types.js"

/**
 * Create a single TimelineItem with sensible defaults.
 *
 * @param overrides - Partial overrides for the item
 * @returns A complete TimelineItem
 */
export function createTestItem(
  overrides: Partial<TimelineItem> & { id: string }
): TimelineItem {
  return {
    startDate: new Date("2026-07-14"),
    endDate: new Date("2026-07-21"),
    data: { title: `Item ${overrides.id}` },
    ...overrides,
  }
}

/**
 * Create multiple test items with sequential IDs and staggered dates.
 *
 * @param count - Number of items to generate
 * @param baseDate - Starting date for the first item (defaults to 2026-07-14)
 * @returns Array of TimelineItems
 */
export function createTestItems(
  count: number,
  baseDate = new Date("2026-07-14")
): TimelineItem[] {
  return Array.from({ length: count }, (_, i) => {
    const startDate = new Date(baseDate)
    startDate.setDate(startDate.getDate() + i * 3)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 7)
    return createTestItem({
      id: `item-${i + 1}`,
      startDate,
      endDate,
      data: { title: `Task ${i + 1}` },
    })
  })
}

/**
 * Create a set of test items with parent-child relationships.
 *
 * @returns Items suitable for testing sub-item modes
 */
export function createNestedTestItems(): TimelineItem[] {
  return [
    createTestItem({
      id: "parent-1",
      startDate: new Date("2026-07-14"),
      endDate: new Date("2026-07-28"),
      data: { title: "Parent Task 1" },
    }),
    createTestItem({
      id: "child-1a",
      startDate: new Date("2026-07-14"),
      endDate: new Date("2026-07-21"),
      parentId: "parent-1",
      data: { title: "Child 1A" },
    }),
    createTestItem({
      id: "child-1b",
      startDate: new Date("2026-07-21"),
      endDate: new Date("2026-07-28"),
      parentId: "parent-1",
      data: { title: "Child 1B" },
    }),
    createTestItem({
      id: "standalone-1",
      startDate: new Date("2026-07-07"),
      endDate: new Date("2026-07-14"),
      data: { title: "Standalone Task" },
    }),
  ]
}

/**
 * Create test dependencies.
 *
 * @returns Array of TimelineDependency objects
 */
export function createTestDependencies(): TimelineDependency[] {
  return [
    {
      id: "dep-1",
      fromItemId: "item-1",
      toItemId: "item-2",
      type: "finish-to-start",
    },
    {
      id: "dep-2",
      fromItemId: "item-1",
      toItemId: "item-3",
      type: "finish-to-start",
    },
  ]
}

/** A fixed "today" date for consistent test assertions */
export const TEST_TODAY = new Date("2026-07-14T12:00:00Z")

/** Standard test date range covering July 2026 */
export const TEST_RANGE = {
  start: new Date("2026-07-01"),
  end: new Date("2026-08-01"),
} as const
