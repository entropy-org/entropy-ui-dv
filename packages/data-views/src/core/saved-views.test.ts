import { describe, expect, it } from "vitest"
import {
  createSavedDataView,
  migrateSavedDataViews,
  validateSavedDataViews,
} from "./saved-views.js"

describe("saved view persistence", () => {
  it("migrates the version-zero shape and supplies an empty query", () => {
    const result = migrateSavedDataViews([
      {
        id: "board",
        name: "Board",
        type: "kanban",
        config: { groupByPropertyId: "status" },
      },
    ])

    expect(result.migrated).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.views[0]).toMatchObject({
      schemaVersion: 1,
      id: "board",
      definition: { type: "kanban", groupByPropertyId: "status" },
      query: { search: "", filters: [], sorts: [], grouping: [] },
    })
  })

  it("reports duplicate ids and missing schema properties", () => {
    const view = createSavedDataView({
      id: "calendar",
      name: "Calendar",
      definition: { type: "calendar", datePropertyId: "starts" },
    })
    const issues = validateSavedDataViews([view, view], {
      propertyIds: new Set(["title"]),
    })

    expect(issues.map((issue) => issue.code)).toEqual([
      "missing-property",
      "duplicate-id",
      "missing-property",
    ])
  })

  it("rejects non-JSON custom plugin settings", () => {
    const result = migrateSavedDataViews([
      {
        schemaVersion: 1,
        id: "custom",
        name: "Custom",
        definition: {
          type: "custom",
          pluginId: "map",
          config: { formatter: () => "nope" },
        },
        query: { search: "", filters: [], sorts: [], grouping: [] },
      },
    ])

    expect(result.views).toEqual([])
    expect(result.issues[0]?.code).toBe("invalid-version")
  })
})
