import { describe, expect, it } from "vitest"
import type { TimelineDependency } from "../types.js"
import { createTestItem } from "../test/fixtures.js"
import {
  canAddTimelineDependency,
  validateTimelineDependencies,
  validateTimelineItems,
} from "./data-validation.js"

describe("timeline production data validation", () => {
  it("reports duplicate ids, invalid ranges, missing parents, and hierarchy cycles", () => {
    const issues = validateTimelineItems([
      createTestItem({ id: "duplicate" }),
      createTestItem({ id: "duplicate" }),
      createTestItem({
        id: "bad-range",
        startDate: new Date("2026-08-03"),
        endDate: new Date("2026-08-01"),
      }),
      createTestItem({ id: "orphan", parentId: "missing" }),
      createTestItem({ id: "cycle-a", parentId: "cycle-b" }),
      createTestItem({ id: "cycle-b", parentId: "cycle-a" }),
    ])

    expect(new Set(issues.map((issue) => issue.code))).toEqual(
      new Set([
        "duplicate-item-id",
        "invalid-range",
        "missing-parent",
        "hierarchy-cycle",
      ])
    )
  })

  it("rejects dependency duplicates, missing endpoints, self links, and cycles", () => {
    const items = [
      createTestItem({ id: "a" }),
      createTestItem({ id: "b" }),
      createTestItem({ id: "c" }),
    ]
    const dependencies: TimelineDependency[] = [
      { id: "a-b", fromItemId: "a", toItemId: "b", type: "finish-to-start" },
      { id: "b-c", fromItemId: "b", toItemId: "c", type: "finish-to-start" },
    ]

    expect(
      canAddTimelineDependency(
        { id: "c-a", fromItemId: "c", toItemId: "a", type: "finish-to-start" },
        dependencies,
        items
      )
    ).toBe(false)
    expect(
      validateTimelineDependencies(
        [
          ...dependencies,
          { id: "self", fromItemId: "a", toItemId: "a", type: "finish-to-start" },
          { id: "missing", fromItemId: "a", toItemId: "z", type: "finish-to-start" },
          { id: "again", fromItemId: "a", toItemId: "b", type: "finish-to-start" },
        ],
        items
      ).map((issue) => issue.code)
    ).toEqual(expect.arrayContaining([
      "self-dependency",
      "missing-dependency-endpoint",
      "duplicate-dependency",
    ]))
  })
})
